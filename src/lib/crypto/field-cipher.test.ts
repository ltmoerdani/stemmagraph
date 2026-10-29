import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEK_LENGTH_BYTES,
  FieldDecryptError,
  decryptField,
  encryptField,
} from './field-cipher';

const KEY_ID = 'dek-2026-10';
const dek = (): Uint8Array => new Uint8Array(randomBytes(DEK_LENGTH_BYTES));

describe('field-cipher', () => {
  it('(a) roundtrip encrypt lalu decrypt menghasilkan plaintext asli dan legacy false', () => {
    const kunci = dek();
    const stored = encryptField(KEY_ID, kunci, 'teks rahasia: v1');
    const hasil = decryptField(KEY_ID, kunci, stored);
    expect(hasil.plaintext).toBe('teks rahasia: v1');
    expect(hasil.legacy).toBe(false);
    expect(stored.split(':')).toHaveLength(5);
  });

  it('(b) tamper satu karakter di segmen tag ditolak FieldDecryptError', () => {
    const kunci = dek();
    const stored = encryptField(KEY_ID, kunci, 'integritas');
    const [v, kid, iv, tag, cipher] = stored.split(':');
    const tagTamper = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
    const rusak = [v, kid, iv, tagTamper, cipher].join(':');
    expect(() => decryptField(KEY_ID, kunci, rusak)).toThrow(FieldDecryptError);
    try {
      decryptField(KEY_ID, kunci, rusak);
    } catch (e) {
      expect((e as FieldDecryptError).code).toBe('FIELD_CIPHER_TAG_MISMATCH');
    }
  });

  it('(c) DEK beda 32 byte ditolak saat encrypt', () => {
    const kunciPendek = new Uint8Array(randomBytes(16));
    expect(() => encryptField(KEY_ID, kunciPendek, 'x')).toThrow(
      FieldDecryptError,
    );
  });

  it('(d) DEK 31 byte ditolak WRONG_DEK_LENGTH', () => {
    const kunci = new Uint8Array(randomBytes(31));
    try {
      encryptField(KEY_ID, kunci, 'x');
      expect.unreachable('harusnya throw');
    } catch (e) {
      expect(e).toBeInstanceOf(FieldDecryptError);
      expect((e as FieldDecryptError).code).toBe(
        'FIELD_CIPHER_WRONG_DEK_LENGTH',
      );
    }
  });

  it('(e) passthrough legacy via onLegacy, flag legacy true', () => {
    const kunci = dek();
    const legacy = 'nilai lama tanpa envelope';
    let diterima = '';
    const hasil = decryptField(KEY_ID, kunci, legacy, {
      onLegacy: (p) => {
        diterima = p;
      },
    });
    expect(diterima).toBe(legacy);
    expect(hasil).toEqual({ plaintext: legacy, legacy: true });
  });

  it('(f) legacy tanpa handler ditolak BAD_FORMAT', () => {
    const kunci = dek();
    expect(() => decryptField(KEY_ID, kunci, 'nilai lama')).toThrow(
      FieldDecryptError,
    );
  });

  it('(g) passthrough legacy tulis ulang: decrypt, encrypt hasilnya, decrypt balik', () => {
    const kunci = dek();
    const legacy = 'data migrasi 2025';
    const { plaintext, legacy: isLegacy } = decryptField(KEY_ID, kunci, legacy, {
      onLegacy: () => {},
    });
    expect(isLegacy).toBe(true);
    const stored = encryptField(KEY_ID, kunci, plaintext);
    const hasil = decryptField(KEY_ID, kunci, stored);
    expect(hasil.plaintext).toBe(legacy);
    expect(hasil.legacy).toBe(false);
  });

  it('(h) keyId berisi titik dua atau kosong ditolak', () => {
    const kunci = dek();
    const tag = Buffer.from(randomBytes(16)).toString('base64');
    const iv = Buffer.from(randomBytes(12)).toString('base64');
    const cipher = Buffer.from('abc').toString('base64');
    const denganTitikDua = ['v1', 'a:b', iv, tag, cipher, cipher].join(':');
    expect(() => decryptField('a:b', kunci, denganTitikDua)).toThrow(
      FieldDecryptError,
    );
    const kosong = ['v1', '', iv, tag, cipher].join(':');
    try {
      decryptField('', kunci, kosong);
      expect.unreachable('harusnya throw');
    } catch (e) {
      expect(e).toBeInstanceOf(FieldDecryptError);
      expect((e as FieldDecryptError).code).toBe('FIELD_CIPHER_BAD_FORMAT');
    }
  });

  it('(i) pure core guard: modul tanpa fs, path, process.env', () => {
    const isi = readFileSync(
      join(process.cwd(), 'src/lib/crypto/field-cipher.ts'),
      'utf8',
    );
    expect(isi).not.toContain("from 'fs'");
    expect(isi).not.toContain("from 'path'");
    expect(isi).not.toContain('process.env');
  });
});
