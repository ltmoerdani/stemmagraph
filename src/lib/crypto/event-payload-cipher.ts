import { decryptField, encryptField } from './field-cipher';

// Cipher payload event: modul pure, tanpa fs dan tanpa env, DEK lewat
// parameter. Envelope mengikuti format field-cipher:
// v1:<keyId>:<iv b64>:<tag b64>:<cipher b64>, plaintext berupa JSON payload.
// Format v2 menambah AAD binding: <keyId> dan <memberId> diikat lewat AAD
// GCM, envelope tetap 5 segmen karena AAD tidak ikut disimpan.
// Nilai lama sebelum migrasi berupa JSON polos tanpa prefix, diteruskan apa
// adanya dengan flag legacy true.

// Nama kolom terikat dalam AAD, mencegah nilai payload dipindah ke kolom lain.
export const EVENT_PAYLOAD_COLUMN = 'payloadJson';

// AAD builder pure, injective fixed-width gaya RFC 5116: tiap komponen diawali
// 8 byte big-endian panjang utf8 lalu byte utf8 komponennya, tanpa pemisah.
// Panjang eksplisit membuat ('k1','m12') dan ('k1m','2') menghasilkan AAD
// berbeda walaupun konkatenasi naifnya identik.
export function buildEventAAD(keyId: string, memberId: string): Buffer {
  const komponen = [keyId, EVENT_PAYLOAD_COLUMN, memberId];
  const bagian = komponen.map((k) => {
    const byte = Buffer.from(k, 'utf8');
    const panjang = Buffer.alloc(8);
    panjang.writeBigUInt64BE(BigInt(byte.length));
    return Buffer.concat([panjang, byte]);
  });
  return Buffer.concat(bagian);
}

// Enkripsi payload arbitrer: stringify lalu delegasi ke encryptField.
export function encryptEventPayload(
  dek: Buffer,
  keyId: string,
  payload: unknown,
): string {
  return encryptField(keyId, dek, JSON.stringify(payload));
}

// Enkripsi payload format v2: sama seperti v1 plus AAD binding keyId dan
// memberId, sehingga ciphertext tidak bisa dipindah antar key atau anggota.
export function encryptEventPayloadV2(
  dek: Buffer,
  keyId: string,
  memberId: string,
  payload: unknown,
): string {
  const aad = buildEventAAD(keyId, memberId);
  return encryptField(keyId, dek, JSON.stringify(payload), { aad });
}

// Dekripsi stored event: prefix v1: atau v2: berarti envelope terenkripsi,
// selain itu JSON lama yang diteruskan apa adanya (passthrough legacy).
// v1 didekripsi tanpa AAD (backward compatible), v2 wajib memberId untuk
// membangun AAD yang cocok dengan saat enkripsi.
export function decryptEventPayload(
  dek: Buffer,
  keyId: string,
  stored: string,
  options?: { memberId?: string },
): { payload: unknown; legacy: boolean; version?: 1 | 2 } {
  // Cek prefix sebelum split supaya JSON lama tidak tersangkut aturan envelope.
  if (!stored.startsWith('v1:') && !stored.startsWith('v2:')) {
    let payload: unknown;
    try {
      payload = JSON.parse(stored) as unknown;
    } catch {
      throw new Error('Payload legacy bukan JSON valid, gagal diparse');
    }
    return { payload, legacy: true };
  }
  const segments = stored.split(':');
  if (segments.length !== 5) {
    throw new Error(
      `Envelope event ${segments[0]} wajib tepat 5 segmen, diterima ${segments.length}`,
    );
  }
  if (segments[0] === 'v2') {
    const memberId = options?.memberId;
    if (memberId === undefined) {
      throw new FieldDecryptError(
        'FIELD_CIPHER_BAD_FORMAT',
        'Envelope v2 butuh memberId di options untuk membangun AAD',
      );
    }
    const aad = buildEventAAD(keyId, memberId);
    const { plaintext } = decryptField(keyId, dek, stored, { aad });
    return { payload: JSON.parse(plaintext) as unknown, legacy: false, version: 2 };
  }
  const { plaintext } = decryptField(keyId, dek, stored);
  return { payload: JSON.parse(plaintext) as unknown, legacy: false, version: 1 };
}
