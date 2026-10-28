import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encryptEventForWrite,
  filterEventsByMember,
  resolveTreeIdForMember,
  type ErasureCryptoPrismaClient,
} from './erasure-crypto-wiring';
import { getOrCreateDek } from '../../lib/crypto/family-key-store';
import {
  decryptEventPayload,
  encryptEventPayload,
} from '../../lib/crypto/event-payload-cipher';

/**
 * Test wiring crypto erasure (GOAL v422 SLICE 2C bagian 1). Prisma struktural
 * di-mock in-memory, kunci diarahkan ke direktori sementara agar test tidak
 * menyentuh .keys-data repo. Cakupan: resolve treeId, fail-open tanpa env,
 * round-trip terenkripsi, passthrough legacy, filter member, row tampered
 * dan row terenkripsi tanpa DEK di-skip tanpa melempar.
 */

const TREE_ID = 'tree1';
const MEMBER_ID = 'm1';

// Mock prisma minimal: hanya familyMember.findUnique yang dibutuhkan wiring.
function buildMockPrisma(
  member: { treeId?: string } | null,
): ErasureCryptoPrismaClient {
  return {
    familyMember: {
      findUnique: vi.fn(async () => member),
    },
  };
}

describe('resolveTreeIdForMember', () => {
  it('mengembalikan null bila member tidak ada', async () => {
    const prisma = buildMockPrisma(null);
    await expect(resolveTreeIdForMember(prisma, MEMBER_ID)).resolves.toBeNull();
    expect(prisma.familyMember.findUnique).toHaveBeenCalledWith({
      where: { id: MEMBER_ID },
      select: { treeId: true },
    });
  });

  it('mengembalikan null bila treeId kosong', async () => {
    const prisma = buildMockPrisma({ treeId: '' });
    await expect(resolveTreeIdForMember(prisma, MEMBER_ID)).resolves.toBeNull();
  });

  it('path biasa mengembalikan treeId member', async () => {
    const prisma = buildMockPrisma({ treeId: 't9' });
    await expect(resolveTreeIdForMember(prisma, MEMBER_ID)).resolves.toBe('t9');
  });
});

describe('encryptEventForWrite', () => {
  let keyDir = '';
  let originalMaster: string | undefined;

  beforeEach(() => {
    keyDir = mkdtempSync(join(tmpdir(), 'stmg-erasure-crypto-'));
    originalMaster = process.env.STMG_MASTER_KEY;
    process.env.STMG_KEY_DIR = keyDir;
  });

  afterEach(() => {
    if (originalMaster === undefined) {
      delete process.env.STMG_MASTER_KEY;
    } else {
      process.env.STMG_MASTER_KEY = originalMaster;
    }
    delete process.env.STMG_KEY_DIR;
    rmSync(keyDir, { recursive: true, force: true });
  });

  it('fail-open tanpa env: plaintext JSON dengan encrypted false', () => {
    delete process.env.STMG_MASTER_KEY;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload = { memberId: MEMBER_ID, note: 'isi sensitif' };
    try {
      const result = encryptEventForWrite(TREE_ID, payload);
      expect(result.encrypted).toBe(false);
      expect(result.stored).toBe(JSON.stringify(payload));
      expect(warnSpy).toHaveBeenCalledOnce();
      // Peringatan tidak boleh memuat isi payload.
      const warnText = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(warnText).not.toContain('isi sensitif');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('round-trip terenkripsi dengan master key 32 byte acak', () => {
    process.env.STMG_MASTER_KEY = randomBytes(32).toString('hex');
    const payload = { memberId: MEMBER_ID, action: 'erase', n: 42 };
    const result = encryptEventForWrite(TREE_ID, payload);
    expect(result.encrypted).toBe(true);
    expect(result.stored.startsWith('v1:')).toBe(true);

    const { dek, keyId } = getOrCreateDek(TREE_ID);
    const decrypted = decryptEventPayload(dek, keyId, result.stored);
    expect(decrypted.legacy).toBe(false);
    expect(decrypted.payload).toEqual(payload);
  });
});

describe('filterEventsByMember', () => {
  const dek = randomBytes(32);
  const keyId = 'k1';

  const encRow = (payload: unknown) => ({
    type: 'consent.granted',
    payloadJson: encryptEventPayload(dek, keyId, payload),
  });
  const legacyRow = (payload: unknown) => ({
    type: 'consent.granted',
    payloadJson: JSON.stringify(payload),
  });

  it('row legacy plaintext lolos tanpa DEK', () => {
    const rowM1 = legacyRow({ memberId: MEMBER_ID, a: 1 });
    const rowM2 = legacyRow({ memberId: 'm2', a: 2 });
    const result = filterEventsByMember([rowM1, rowM2], null, keyId, MEMBER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(rowM1);
    expect(result[0].payloadJson).toBe(rowM1.payloadJson);
  });

  it('row terenkripsi terfilter benar, payloadJson asli dipertahankan', () => {
    const rowM1 = encRow({ memberId: MEMBER_ID, a: 1 });
    const rowM2 = encRow({ memberId: 'm2', a: 2 });
    const result = filterEventsByMember([rowM1, rowM2], dek, keyId, MEMBER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(rowM1);
    expect(result[0].payloadJson).toBe(rowM1.payloadJson);
    expect(result[0].payloadJson.startsWith('v1:')).toBe(true);
  });

  it('row tampered di-skip tanpa melempar, row lain tetap lolos', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const intact = encRow({ memberId: MEMBER_ID, a: 1 }).payloadJson;
    // Rusak 4 karakter terakhir segmen cipher supaya auth tag GCM gagal.
    const tampered = intact.slice(0, -4) + 'AAAA';
    expect(tampered).not.toBe(intact);
    const rowGood = legacyRow({ memberId: MEMBER_ID, a: 9 });
    try {
      const result = filterEventsByMember(
        [
          { type: 'consent.granted', payloadJson: tampered },
          rowGood,
        ],
        dek,
        keyId,
        MEMBER_ID,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(rowGood);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('row terenkripsi dengan dek null di-skip', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rowEnc = encRow({ memberId: MEMBER_ID, a: 1 });
    try {
      const result = filterEventsByMember([rowEnc], null, keyId, MEMBER_ID);
      expect(result).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledOnce();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
