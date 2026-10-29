import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

// Kode error terstruktur untuk kegagalan decrypt field.
export class FieldDecryptError extends Error {
  code:
    | 'FIELD_CIPHER_BAD_FORMAT'
    | 'FIELD_CIPHER_TAG_MISMATCH'
    | 'FIELD_CIPHER_AAD_MISMATCH'
    | 'FIELD_CIPHER_KEY_ID_MISMATCH'
    | 'FIELD_CIPHER_WRONG_DEK_LENGTH';

  constructor(code: FieldDecryptError['code'], message: string) {
    super(message);
    this.name = 'FieldDecryptError';
    this.code = code;
  }
}

export const DEK_LENGTH_BYTES = 32;
export const FIELD_CIPHER_IV_BYTES = 12;

const KEY_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

// Envelope format: v1:<keyId>:<iv b64>:<tag b64>:<cipher b64>
export function encryptField(
  keyId: string,
  dek: Uint8Array,
  plaintext: string,
  options?: { aad?: Uint8Array },
): string {
  if (dek.length !== DEK_LENGTH_BYTES) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_WRONG_DEK_LENGTH',
      `DEK harus ${DEK_LENGTH_BYTES} byte, diterima ${dek.length} byte`,
    );
  }
  const iv = randomBytes(FIELD_CIPHER_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(dek), iv);
  // AAD opsional dipasang sebelum update, tidak ikut masuk envelope, binding
  // implisit: pemanggil decrypt wajib membangun AAD yang identik.
  if (options?.aad) {
    cipher.setAAD(Buffer.from(options.aad));
  }
  const cipherText = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    keyId,
    iv.toString('base64'),
    tag.toString('base64'),
    cipherText.toString('base64'),
  ].join(':');
}

export function decryptField(
  keyId: string,
  dek: Uint8Array,
  stored: string,
  options?: { onLegacy?: (p: string) => void; aad?: Uint8Array },
): { plaintext: string; legacy: boolean } {
  const segments = stored.split(':');
  // Nilai sebelum migrasi disimpan polos, lewatkan ke callback bila disediakan.
  if (segments[0] !== 'v1') {
    if (options?.onLegacy) {
      options.onLegacy(stored);
      return { plaintext: stored, legacy: true };
    }
    throw new FieldDecryptError(
      'FIELD_CIPHER_BAD_FORMAT',
      'Envelope tidak dikenal dan tidak ada handler legacy',
    );
  }
  if (segments.length !== 5) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_BAD_FORMAT',
      'Envelope v1 wajib tepat 5 segmen',
    );
  }
  const [, storedKeyId, ivB64, tagB64, cipherB64] = segments;
  if (!KEY_ID_PATTERN.test(storedKeyId)) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_BAD_FORMAT',
      'keyId pada envelope tidak valid',
    );
  }
  if (storedKeyId !== keyId) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_KEY_ID_MISMATCH',
      `keyId envelope ${storedKeyId} tidak cocok dengan ${keyId}`,
    );
  }
  if (dek.length !== DEK_LENGTH_BYTES) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_WRONG_DEK_LENGTH',
      `DEK harus ${DEK_LENGTH_BYTES} byte, diterima ${dek.length} byte`,
    );
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const cipherText = Buffer.from(cipherB64, 'base64');
  if (iv.length !== FIELD_CIPHER_IV_BYTES) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_BAD_FORMAT',
      `IV harus ${FIELD_CIPHER_IV_BYTES} byte`,
    );
  }
  if (tag.length !== 16) {
    throw new FieldDecryptError(
      'FIELD_CIPHER_BAD_FORMAT',
      'Auth tag harus 16 byte',
    );
  }
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(dek), iv);
  decipher.setAuthTag(tag);
  if (options?.aad) {
    decipher.setAAD(Buffer.from(options.aad));
  }
  try {
    const plaintext = Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]);
    return { plaintext: plaintext.toString('utf8'), legacy: false };
  } catch {
    // Dengan AAD terpasang, kegagalan final() berarti verifikasi integritas
    // GCM gagal. GCM tidak bisa memisahkan penyebabnya: AAD dan ciphertext
    // sama-sama tercakup satu auth tag, jadi keduanya sama-sama dicurigai.
    // Tanpa AAD, perilaku lama dipertahankan sebagai TAG_MISMATCH.
    if (options?.aad) {
      throw new FieldDecryptError(
        'FIELD_CIPHER_AAD_MISMATCH',
        'Integritas GCM gagal: AAD atau ciphertext kemungkinan berubah',
      );
    }
    throw new FieldDecryptError(
      'FIELD_CIPHER_TAG_MISMATCH',
      'Verifikasi auth tag gagal',
    );
  }
}
