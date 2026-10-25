/**
 * v398 Upload Foto Anggota fase 1: validasi file gambar murni.
 *
 * Modul pure (tanpa I/O): magic bytes allowlist MIME (JPEG FFD8FF,
 * PNG 89504E47, WebP RIFF....WEBP) dan batas ukuran 10 MB. Filename
 * internal selalu di-generate server (UUID), sehingga nihil path
 * traversal lewat jalur ini; modul ini sengaja tidak menerima filename
 * dari pihak lain sama sekali (OWASP File Upload Cheat Sheet).
 */

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type PhotoValidationResult =
  | { ok: true; mime: PhotoMime }
  | { ok: false; reason: 'EMPTY_FILE' | 'TOO_LARGE' | 'NOT_AN_IMAGE' };

/**
 * Kenali tipe gambar dari magic bytes saja (bukan dari header deklarasi
 * klien). JPEG: FF D8 FF. PNG: 89 50 4E 47. WebP: RIFF ???? WEBP
 * (empat byte ukuran diabaikan sesuai spesifikasi container RIFF).
 */
export function detectPhotoMime(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  return null;
}

/** Validasi satu unggahan: ukuran lalu magic bytes. */
export function validatePhotoUpload(bytes: Uint8Array): PhotoValidationResult {
  if (bytes.length === 0) return { ok: false, reason: 'EMPTY_FILE' };
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, reason: 'TOO_LARGE' };
  const mime = detectPhotoMime(bytes);
  if (mime === null) return { ok: false, reason: 'NOT_AN_IMAGE' };
  return { ok: true, mime };
}
