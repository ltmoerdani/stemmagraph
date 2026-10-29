import { mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decryptEventPayload,
  encryptEventPayload,
} from './event-payload-cipher';
import {
  getDekByKeyId,
  getOrCreateDek,
  listKeyIds,
  rotateDek,
} from './family-key-store';

let keyDir: string;
let kel1DekHex: string;
let kel3DekLamaHex: string;

beforeAll(() => {
  process.env.STMG_MASTER_KEY = 'test-master-key-v422';
  keyDir = mkdtempSync(join(tmpdir(), 'v422-keys-'));
  process.env.STMG_KEY_DIR = keyDir;
});

afterAll(() => {
  delete process.env.STMG_KEY_DIR;
  rmSync(keyDir, { recursive: true, force: true });
});

describe('family-key-store', () => {
  it('(1) getOrCreateDek kel1 pertama menghasilkan keyId k1 dan dek 32 byte', () => {
    const hasil = getOrCreateDek('kel1');
    expect(hasil.keyId).toBe('k1');
    expect(hasil.dek).toHaveLength(32);
    kel1DekHex = hasil.dek.toString('hex');
  });

  it('(2) panggilan kedua treeId sama mengembalikan dek dan keyId yang sama', () => {
    const hasil = getOrCreateDek('kel1');
    expect(hasil.keyId).toBe('k1');
    expect(hasil.dek.toString('hex')).toBe(kel1DekHex);
  });

  it('(3) treeId kel2 menghasilkan dek yang berbeda dari kel1', () => {
    const hasil = getOrCreateDek('kel2');
    expect(hasil.keyId).toBe('k1');
    expect(hasil.dek.toString('hex')).not.toBe(kel1DekHex);
    expect(hasil.dek).toHaveLength(32);
  });

  it('(4) rotasi manual rename k1 ke k9 lalu getOrCreateDek menghasilkan k10 monoton', () => {
    renameSync(join(keyDir, 'kel2.k1.json'), join(keyDir, 'kel2.k9.json'));
    const hasil = getOrCreateDek('kel2');
    expect(hasil.keyId).toBe('k10');
    expect(hasil.dek).toHaveLength(32);
  });

  it('(5) isi kel1.k1.json tidak mengandung dek hex maupun base64', () => {
    const isi = readFileSync(join(keyDir, 'kel1.k1.json'), 'utf8');
    const dek = Buffer.from(kel1DekHex, 'hex');
    expect(isi).not.toContain(dek.toString('hex'));
    expect(isi).not.toContain(dek.toString('base64'));
  });

  it.runIf(process.platform !== 'win32')(
    '(6) file kunci memiliki permission mode 0600 di POSIX',
    () => {
      const stat = statSync(join(keyDir, 'kel1.k1.json'));
      expect(stat.mode & 0o777).toBe(0o600);
    },
  );

  it('(7) STMG_MASTER_KEY kosong membuat getOrCreateDek throw Error', () => {
    const lama = process.env.STMG_MASTER_KEY;
    delete process.env.STMG_MASTER_KEY;
    try {
      expect(() => getOrCreateDek('kel1')).toThrow(Error);
      expect(() => getOrCreateDek('kel1')).toThrow('STMG_MASTER_KEY wajib diset');
    } finally {
      process.env.STMG_MASTER_KEY = lama;
    }
  });

  it('(8) treeId tidak valid membuat getOrCreateDek throw Error', () => {
    expect(() => getOrCreateDek('bad/id')).toThrow(Error);
  });

  it('(9) listKeyIds kel2 terurut generasi naik benar', () => {
    expect(listKeyIds('kel2')).toEqual(['k9', 'k10']);
  });

  it('(10) rotateDek kel3 menghasilkan generasi baru k2 dan dek berbeda dari dek aktif sebelumnya', () => {
    const lama = getOrCreateDek('kel3');
    kel3DekLamaHex = lama.dek.toString('hex');
    const hasil = rotateDek('kel3');
    expect(hasil.keyId).toBe('k2');
    expect(hasil.dek).toHaveLength(32);
    expect(hasil.dek.toString('hex')).not.toBe(kel3DekLamaHex);
  });

  it('(11) getOrCreateDek kel3 setelah rotateDek mengembalikan generasi baru k2 tanpa gap', () => {
    const hasil = getOrCreateDek('kel3');
    expect(hasil.keyId).toBe('k2');
    expect(hasil.dek.toString('hex')).not.toBe(kel3DekLamaHex);
  });

  it('(12) getDekByKeyId kel3 generasi lama k1 masih mengembalikan dek lama yang sama', () => {
    const lama = getDekByKeyId('kel3', 'k1');
    expect(lama).not.toBeNull();
    if (lama === null) return;
    expect(lama.toString('hex')).toBe(kel3DekLamaHex);
  });

  it('(13) getDekByKeyId kel3 keyId tidak dikenal k99 mengembalikan null tanpa throw', () => {
    expect(getDekByKeyId('kel3', 'k99')).toBeNull();
  });

  it('(14) getDekByKeyId dengan STMG_MASTER_KEY kosong mengembalikan null tanpa throw', () => {
    const simpan = process.env.STMG_MASTER_KEY;
    delete process.env.STMG_MASTER_KEY;
    try {
      expect(getDekByKeyId('kel1', 'k1')).toBeNull();
    } finally {
      process.env.STMG_MASTER_KEY = simpan;
    }
  });

  it('(15) roundtrip event dek generasi lama tetap terbaca setelah rotate', () => {
    const lama = getOrCreateDek('kel4');
    const stored = encryptEventPayload(lama.dek, lama.keyId, { isi: 'peserta' });
    const baru = rotateDek('kel4');
    expect(baru.keyId).toBe('k2');
    const dekLama = getDekByKeyId('kel4', lama.keyId);
    expect(dekLama).not.toBeNull();
    if (dekLama === null) return;
    const terbaca = decryptEventPayload(dekLama, lama.keyId, stored);
    expect(terbaca.legacy).toBe(false);
    expect(terbaca.payload).toEqual({ isi: 'peserta' });
  });
});
