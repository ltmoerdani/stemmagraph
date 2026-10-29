import { decryptField, encryptField } from './field-cipher';

// Cipher payload event: modul pure, tanpa fs dan tanpa env, DEK lewat
// parameter. Envelope mengikuti format field-cipher:
// v1:<keyId>:<iv b64>:<tag b64>:<cipher b64>, plaintext berupa JSON payload.
// Nilai lama sebelum migrasi berupa JSON polos tanpa prefix, diteruskan apa
// adanya dengan flag legacy true.

// Enkripsi payload arbitrer: stringify lalu delegasi ke encryptField.
export function encryptEventPayload(
  dek: Buffer,
  keyId: string,
  payload: unknown,
): string {
  return encryptField(keyId, dek, JSON.stringify(payload));
}

// Dekripsi stored event: prefix v1: berarti envelope terenkripsi, selain itu
// JSON lama yang diteruskan apa adanya (passthrough legacy).
export function decryptEventPayload(
  dek: Buffer,
  keyId: string,
  stored: string,
): { payload: unknown; legacy: boolean } {
  // Cek prefix sebelum split supaya JSON lama tidak tersangkut aturan envelope.
  if (!stored.startsWith('v1:')) {
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
      `Envelope event v1 wajib tepat 5 segmen, diterima ${segments.length}`,
    );
  }
  const { plaintext } = decryptField(keyId, dek, stored);
  return { payload: JSON.parse(plaintext) as unknown, legacy: false };
}
