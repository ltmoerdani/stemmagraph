import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEK_LENGTH_BYTES } from './field-cipher';
import {
  decryptEventPayload,
  encryptEventPayload,
  encryptEventPayloadV2,
} from './event-payload-cipher';
import {
  planBackfillBatch,
  type BackfillOp,
  type BackfillRow,
} from './event-backfill-plan';

const KEY_ID = 'dek-2026-10';
const dek = (): Buffer => randomBytes(DEK_LENGTH_BYTES);

// Resolver sederhana: satu keyId dipetakan ke satu DEK tetap per test.
const resolverDari = (keyId: string, kunci: Buffer) => (dicari: string) =>
  dicari === keyId ? kunci : null;

const encryptOps = (ops: BackfillOp[]) =>
  ops.filter((op): op is Extract<BackfillOp, { kind: 'encrypt' }> => op.kind === 'encrypt');

const errorOps = (ops: BackfillOp[]) =>
  ops.filter((op): op is Extract<BackfillOp, { kind: 'error' }> => op.kind === 'error');

const baris = (
  id: string,
  memberId: string,
  keyId: string,
  stored: string,
): BackfillRow => ({ id, memberId, keyId, stored });

describe('planBackfillBatch', () => {
  it('1. v1 diubah ke v2 dengan AAD binding keyId+memberId, nextStored terverifikasi balik', () => {
    const kunci = dek();
    const payload = { jenis: 'node.updated', nama: 'Silalahi' };
    const storedV1 = encryptEventPayload(kunci, KEY_ID, payload);
    const ops = planBackfillBatch(
      [baris('e-1', 'm-77', KEY_ID, storedV1)],
      resolverDari(KEY_ID, kunci),
    );
    expect(ops).toHaveLength(1);
    const op = encryptOps(ops)[0];
    expect(op.rowId).toBe('e-1');
    expect(op.memberId).toBe('m-77');
    expect(op.keyId).toBe(KEY_ID);
    expect(op.nextStored.startsWith('v2:')).toBe(true);
    // Dekripsi balik dengan AAD binding memberId menghasilkan payload asli
    // dan penanda versi 2, membuktikan AAD benar-benar terikat.
    const balik = decryptEventPayload(kunci, KEY_ID, op.nextStored, {
      memberId: 'm-77',
    });
    expect(balik.payload).toEqual(payload);
    expect(balik.legacy).toBe(false);
    expect(balik.version).toBe(2);
  });

  it('2. legacy JSON polos naik kelas ke v2', () => {
    const kunci = dek();
    const payload = { jenis: 'legacy', catatan: 'data lama' };
    const storedLegacy = JSON.stringify(payload);
    const ops = planBackfillBatch(
      [baris('e-2', 'm-8', KEY_ID, storedLegacy)],
      resolverDari(KEY_ID, kunci),
    );
    const op = encryptOps(ops);
    expect(op).toHaveLength(1);
    expect(op[0].nextStored.startsWith('v2:')).toBe(true);
    const balik = decryptEventPayload(kunci, KEY_ID, op[0].nextStored, {
      memberId: 'm-8',
    });
    expect(balik.payload).toEqual(payload);
    expect(balik.version).toBe(2);
  });

  it('3. baris v2 dijalankan ulang dua kali menghasilkan nihil op (idempoten)', () => {
    const kunci = dek();
    const payload = { jenis: 'sudah.v2' };
    const storedV2 = encryptEventPayloadV2(kunci, KEY_ID, 'm-9', payload);
    const rows = [baris('e-3', 'm-9', KEY_ID, storedV2)];
    const resolve = resolverDari(KEY_ID, kunci);
    const pertama = planBackfillBatch(rows, resolve);
    const kedua = planBackfillBatch(rows, resolve);
    expect(pertama).toEqual([]);
    expect(kedua).toEqual([]);
    expect(pertama).toEqual(kedua);
  });

  it('4. dek resolver null menghasilkan op error dek_missing tanpa throw', () => {
    const storedV1 = encryptEventPayload(dek(), KEY_ID, { jenis: 'x' });
    const ops = planBackfillBatch(
      [baris('e-4', 'm-1', KEY_ID, storedV1)],
      () => null,
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      kind: 'error',
      rowId: 'e-4',
      reason: 'dek_missing',
    });
  });

  it('5. legacy JSON rusak menghasilkan op error legacy_invalid_json tanpa throw', () => {
    const kunci = dek();
    const ops = planBackfillBatch(
      [baris('e-5', 'm-2', KEY_ID, '{bukan json valid')],
      resolverDari(KEY_ID, kunci),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      kind: 'error',
      rowId: 'e-5',
      reason: 'legacy_invalid_json',
    });
  });

  it('6. envelope v1 ditamper menghasilkan op error envelope_corrupt tanpa throw', () => {
    const kunci = dek();
    const storedV1 = encryptEventPayload(kunci, KEY_ID, { jenis: 'x' });
    // Tamper segmen ciphertext terakhir tanpa merusak struktur 5 segmen.
    const segmen = storedV1.split(':');
    const cipher = Buffer.from(segmen[4], 'base64');
    cipher[0] = cipher[0] ^ 0xff;
    segmen[4] = cipher.toString('base64');
    const tampered = segmen.join(':');
    const ops = planBackfillBatch(
      [baris('e-6', 'm-3', KEY_ID, tampered)],
      resolverDari(KEY_ID, kunci),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      kind: 'error',
      rowId: 'e-6',
      reason: 'envelope_corrupt',
    });
  });

  it('7. dua baris beda nasib dalam satu batch: satu encrypt, satu skip v2', () => {
    const kunci = dek();
    const payload = { jenis: 'campuran' };
    const storedV1 = encryptEventPayload(kunci, KEY_ID, payload);
    const storedV2 = encryptEventPayloadV2(kunci, KEY_ID, 'm-11', {
      jenis: 'sudah.v2',
    });
    const ops = planBackfillBatch(
      [
        baris('e-7a', 'm-10', KEY_ID, storedV1),
        baris('e-7b', 'm-11', KEY_ID, storedV2),
      ],
      resolverDari(KEY_ID, kunci),
    );
    // Hanya baris v1 yang menghasilkan op, baris v2 senyap total.
    expect(ops).toHaveLength(1);
    expect(errorOps(ops)).toHaveLength(0);
    const op = encryptOps(ops)[0];
    expect(op.rowId).toBe('e-7a');
    expect(op.nextStored.startsWith('v2:')).toBe(true);
    const balik = decryptEventPayload(kunci, KEY_ID, op.nextStored, {
      memberId: 'm-10',
    });
    expect(balik.payload).toEqual(payload);
    expect(balik.version).toBe(2);
  });
});
