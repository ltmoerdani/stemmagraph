/**
 * v398 AC2: persiapan gambar di CLIENT sebelum unggah.
 *
 * Re-encode via canvas offscreen + toBlob: dekode gambar membuang semua
 * metadata termasuk EXIF (GPS) karena canvas hanya menyimpan piksel, dan
 * hasil encode browser tidak menulis ulang metadata asli. Tanpa
 * dependency baru; sharp tidak tersedia di project ini.
 *
 * Validasi awal client: tipe allowlist dan dimensi minimum, supaya file
 * jelas salah ditolak sebelum jaringan; validasi otoritatif tetap di
 * server (magic bytes, ukuran).
 */

export const PHOTO_CLIENT_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIN_DIMENSION = 16;

export type ClientPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type ClientPhotoError =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'NOT_AN_IMAGE'
  | 'TOO_SMALL';

/** Deteksi MIME kasar di client dari magic bytes (bukan nama file). */
export function sniffImageMime(bytes: Uint8Array): ClientPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Dekode gambar ke bitmap via createImageBitmap lalu gambar ke canvas
 * offscreen dan encode ulang via toBlob (default image/jpeg dipertahankan
 * untuk kompatibilitas; PNG/WebP diteruskan sebagai tipe asal).
 */
export async function reencodeImageStripMetadata(
  bytes: Uint8Array,
  mime: ClientPhotoMime,
): Promise<Blob> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const outType = mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, 0.92));
    if (blob === null) throw new Error('canvas toBlob returned null');
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Pipeline lengkap client: validasi ukuran + magic bytes, re-encode strip
 * metadata, kembalikan blob siap unggah. Melempar Error dengan pesan kode
 * ClientPhotoError agar UI bisa memetakan ke i18n.
 */
export async function preparePhotoForUpload(bytes: Uint8Array): Promise<{
  blob: Blob;
  mime: ClientPhotoMime;
}> {
  if (bytes.length === 0) throw new Error('EMPTY_FILE');
  if (bytes.length > PHOTO_CLIENT_MAX_BYTES) throw new Error('TOO_LARGE');
  const mime = sniffImageMime(bytes);
  if (mime === null) throw new Error('NOT_AN_IMAGE');
  if (typeof createImageBitmap !== 'function') {
    // Environment tanpa API gambar browser (node test): tidak bisa
    // diproses di client, tolak jujur alih-alih kirim file tak terverifikasi.
    throw new Error('NOT_AN_IMAGE');
  }
  const bitmapProbe = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime })).catch(
    () => null,
  );
  if (bitmapProbe === null) throw new Error('NOT_AN_IMAGE');
  const tooSmall =
    bitmapProbe.width < PHOTO_MIN_DIMENSION || bitmapProbe.height < PHOTO_MIN_DIMENSION;
  bitmapProbe.close();
  if (tooSmall) throw new Error('TOO_SMALL');
  const blob = await reencodeImageStripMetadata(bytes, mime);
  if (blob.size > PHOTO_CLIENT_MAX_BYTES) throw new Error('TOO_LARGE');
  return { blob, mime };
}
