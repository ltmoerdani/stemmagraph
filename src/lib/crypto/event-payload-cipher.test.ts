import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEK_LENGTH_BYTES, FieldDecryptError } from './field-cipher';
import {
  buildEventAAD,
  decryptEventPayload,
  encryptEventPayload,
  encryptEventPayloadV2,
} from './event-payload-cipher';

const KEY_ID = 'dek-2026-10';
const dek = (): Buffer => randomBytes(DEK_LENGTH_BYTES);

describe('event-payload-cipher', () => {
  it('(a) roundtrip payload objek menghasilkan payload asli dan legacy false', () => {
    const kunci = dek();
    const payload = { jenis: 'node.updated', versi: 3 };
    const stored = encryptEventPayload(kunci, KEY_ID, payload);
    const hasil = decryptEventPayload(kunci, KEY_ID, stored);
    expect(hasil.payload).toEqual(payload);
    expect(hasil.legacy).toBe(false);
    expect(stored.split(':')).toHaveLength(5);
    expect(stored.startsWith('v1:')).toBe(true);
  });

  it('(b) roundtrip payload bertingkat dengan array null dan unicode', () => {
    const kunci = dek();
    const payload = {
      pohon: { id: 't-1', nama: 'Keluarga Öztürk' },
      anggota: [
        { id: 'p1', orangTua: null },
        { id: 'p2', catatan: ['a', 'b', { dalam: true }], jumlah: 42 },
      ],
      aktif: false,
    };
    const stored = encryptEventPayload(kunci, KEY_ID, payload);
    const hasil = decryptEventPayload(kunci, KEY_ID, stored);
    expect(hasil.payload).toEqual(payload);
    expect(hasil.legacy).toBe(false);
  });

  it('(c) passthrough legacy JSON lama tanpa prefix menghasilkan legacy true', () => {
    const kunci = dek();
    const legacy = JSON.stringify({ jenis: 'node.created', id: 'n-9' });
    const hasil = decryptEventPayload(kunci, KEY_ID, legacy);
    expect(hasil.legacy).toBe(true);
    expect(hasil.payload).toEqual({ jenis: 'node.created', id: 'n-9' });
  });

  it('(d) passthrough legacy tulis ulang: decrypt lalu encrypt balik konsisten', () => {
    const kunci = dek();
    const legacy = JSON.stringify({ jenis: 'edge.added', bobot: 2 });
    const pertama = decryptEventPayload(kunci, KEY_ID, legacy);
    expect(pertama.legacy).toBe(true);
    const stored = encryptEventPayload(kunci, KEY_ID, pertama.payload);
    expect(stored.startsWith('v1:')).toBe(true);
    const kedua = decryptEventPayload(kunci, KEY_ID, stored);
    expect(kedua.legacy).toBe(false);
    expect(kedua.payload).toEqual({ jenis: 'edge.added', bobot: 2 });
  });

  it('(e) tamper segmen ciphertext ditolak FieldDecryptError', () => {
    const kunci = dek();
    const stored = encryptEventPayload(kunci, KEY_ID, { id: 1 });
    const [v, kid, iv, tag, cipher] = stored.split(':');
    const cipherTamper = (cipher[0] === 'A' ? 'B' : 'A') + cipher.slice(1);
    const rusak = [v, kid, iv, tag, cipherTamper].join(':');
    expect(() => decryptEventPayload(kunci, KEY_ID, rusak)).toThrow(
      FieldDecryptError,
    );
    try {
      decryptEventPayload(kunci, KEY_ID, rusak);
    } catch (e) {
      expect((e as FieldDecryptError).code).toBe('FIELD_CIPHER_TAG_MISMATCH');
    }
  });

  it('(f) format salah v1 tanpa bagian lengkap ditolak pesan jelas', () => {
    const kunci = dek();
    expect(() => decryptEventPayload(kunci, KEY_ID, 'v1:k1')).toThrow(
      /5 segmen/,
    );
    expect(() =>
      decryptEventPayload(kunci, KEY_ID, 'v1:k1:iv:tag'),
    ).toThrow(/5 segmen/);
  });

  it('(g) pure core guard: modul tanpa fs, path, process.env', () => {
    const isi = readFileSync(
      join(process.cwd(), 'src/lib/crypto/event-payload-cipher.ts'),
      'utf8',
    );
    expect(isi).not.toContain("from 'fs'");
    expect(isi).not.toContain("from 'node:fs'");
    expect(isi).not.toContain("from 'path'");
    expect(isi).not.toContain('process.env');
  });
});

describe('v2 AAD', () => {
  it('(a) roundtrip v2 dengan memberId sama, payload bertingkat utuh, version 2, envelope 5 segmen', () => {
    const kunci = dek();
    const payload = {
      pohon: { id: 't-7', nama: 'Keluarga Öztürk' },
      anggota: [{ id: 'p1', catatan: null }, { id: 'p2', nilai: [1, 2, { dalam: true }] }],
      aktif: false,
    };
    const stored = encryptEventPayloadV2(kunci, KEY_ID, 'm-42', payload);
    const hasil = decryptEventPayload(kunci, KEY_ID, stored, { memberId: 'm-42' });
    expect(hasil.payload).toEqual(payload);
    expect(hasil.legacy).toBe(false);
    expect(hasil.version).toBe(2);
    expect(stored.startsWith('v2:')).toBe(true);
    expect(stored.split(':')).toHaveLength(5);
  });

  it('(b) decrypt v2 dengan memberId berbeda ditolak AAD_MISMATCH', () => {
    const kunci = dek();
    const stored = encryptEventPayloadV2(kunci, KEY_ID, 'm-42', { rahasia: 1 });
    try {
      decryptEventPayload(kunci, KEY_ID, stored, { memberId: 'm-43' });
      expect.unreachable('harusnya throw');
    } catch (e) {
      expect(e).toBeInstanceOf(FieldDecryptError);
      expect((e as FieldDecryptError).code).toBe('FIELD_CIPHER_AAD_MISMATCH');
    }
  });

  it('(c) v2 tanpa memberId di options ditolak BAD_FORMAT', () => {
    const kunci = dek();
    const stored = encryptEventPayloadV2(kunci, KEY_ID, 'm-42', { rahasia: 1 });
    try {
      decryptEventPayload(kunci, KEY_ID, stored);
      expect.unreachable('harusnya throw');
    } catch (e) {
      expect(e).toBeInstanceOf(FieldDecryptError);
      expect((e as FieldDecryptError).code).toBe('FIELD_CIPHER_BAD_FORMAT');
    }
  });

  it('(d) tamper byte pertama cipher b64 v2 ditolak FieldDecryptError', () => {
    const kunci = dek();
    const stored = encryptEventPayloadV2(kunci, KEY_ID, 'm-42', { rahasia: 1 });
    const [v, kid, iv, tag, cipher] = stored.split(':');
    const cipherTamper = (cipher[0] === 'A' ? 'B' : 'A') + cipher.slice(1);
    const rusak = [v, kid, iv, tag, cipherTamper].join(':');
    expect(() => decryptEventPayload(kunci, KEY_ID, rusak, { memberId: 'm-42' })).toThrow(
      FieldDecryptError,
    );
  });

  it('(e) baris v1 lama tetap terbaca tanpa memberId, version 1', () => {
    const kunci = dek();
    const stored = encryptEventPayload(kunci, KEY_ID, { jenis: 'node.updated' });
    const hasil = decryptEventPayload(kunci, KEY_ID, stored);
    expect(hasil.payload).toEqual({ jenis: 'node.updated' });
    expect(hasil.legacy).toBe(false);
    expect(hasil.version).toBe(1);
  });

  it('(f) legacy JSON polos tetap passthrough legacy true tanpa version', () => {
    const kunci = dek();
    const legacy = JSON.stringify({ jenis: 'node.created', id: 'n-9' });
    const hasil = decryptEventPayload(kunci, KEY_ID, legacy);
    expect(hasil.legacy).toBe(true);
    expect(hasil.version).toBeUndefined();
    expect(hasil.payload).toEqual({ jenis: 'node.created', id: 'n-9' });
  });

  it('(g) injectivity fixed-width: k1+m12 dan k1m+2 menghasilkan aad berbeda', () => {
    const a = buildEventAAD('k1', 'm12');
    const b = buildEventAAD('k1m', '2');
    expect(a.toString('hex')).not.toBe(b.toString('hex'));
  });

  it('(h) pure core guard: kedua modul cipher tanpa fs, path, process.env', () => {
    const isiField = readFileSync(
      join(process.cwd(), 'src/lib/crypto/field-cipher.ts'),
      'utf8',
    );
    const isiEvent = readFileSync(
      join(process.cwd(), 'src/lib/crypto/event-payload-cipher.ts'),
      'utf8',
    );
    for (const isi of [isiField, isiEvent]) {
      expect(isi).not.toContain("from 'fs'");
      expect(isi).not.toContain("from 'node:fs'");
      expect(isi).not.toContain("from 'path'");
      expect(isi).not.toContain("from 'node:path'");
      expect(isi).not.toContain('process.env');
    }
  });
});
