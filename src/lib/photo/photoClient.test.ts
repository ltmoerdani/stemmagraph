/**
 * Test v398 AC2/AC6: modul pure photoClient (validasi client + strip
 * metadata via canvas).
 *
 * createImageBitmap dan canvas tidak tersedia di environment node/vitest
 * default; pipeline penuh diuji hanya bagian yang tidak butuh DOM:
 * sniff magic bytes, penolakan EMPTY_FILE/TOO_LARGE/NOT_AN_IMAGE. Jalur
 * re-encode diuji di test wiring UI jsdom dengan mock.
 */
import { describe, expect, it } from 'vitest';
import {
  PHOTO_CLIENT_MAX_BYTES,
  PHOTO_MIN_DIMENSION,
  preparePhotoForUpload,
  sniffImageMime,
} from './photoClient';

const jpegBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return b;
};
const pngBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0x89; b[1] = 0x50; b[2] = 0x4e; b[3] = 0x47;
  return b;
};
const webpBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0x52; b[1] = 0x49; b[2] = 0x46; b[3] = 0x46;
  b[8] = 0x57; b[9] = 0x45; b[10] = 0x42; b[11] = 0x50;
  return b;
};

describe('sniffImageMime', () => {
  it('JPEG FF D8 FF dikenali di awal file', () => {
    expect(sniffImageMime(jpegBytes(16))).toBe('image/jpeg');
  });

  it('PNG 89504E47 dikenali', () => {
    expect(sniffImageMime(pngBytes(16))).toBe('image/png');
  });

  it('WebP RIFF....WEBP dikenali tanpa memandang ukuran RIFF', () => {
    expect(sniffImageMime(webpBytes(16))).toBe('image/webp');
  });

  it('bukan gambar = null', () => {
    expect(sniffImageMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
  });

  it('file pendek tidak melempar, cukup mengembalikan null', () => {
    expect(sniffImageMime(new Uint8Array([0x52, 0x49]))).toBeNull();
  });
});

describe('preparePhotoForUpload penolakan dini tanpa DOM', () => {
  it('EMPTY_FILE untuk byte kosong', async () => {
    await expect(preparePhotoForUpload(new Uint8Array(0))).rejects.toThrow('EMPTY_FILE');
  });

  it('TOO_LARGE melebihi 10 MB', async () => {
    const big = jpegBytes(PHOTO_CLIENT_MAX_BYTES + 1);
    await expect(preparePhotoForUpload(big)).rejects.toThrow('TOO_LARGE');
  });

  it('NOT_AN_IMAGE untuk byte acak', async () => {
    await expect(preparePhotoForUpload(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow(
      'NOT_AN_IMAGE',
    );
  });

  it('createImageBitmap gagal pada file JPEG palsu => NOT_AN_IMAGE', async () => {
    // createImageBitmap ada di jsdom? tidak; di node test environment ini
    // tidak terdefinisi sehingga probe gagal dan pipeline menolak jujur.
    await expect(preparePhotoForUpload(jpegBytes(64))).rejects.toThrow('NOT_AN_IMAGE');
  });
});

describe('konstanta', () =>
  it('dimensi minimum terdokumentasi', () => {
    expect(PHOTO_MIN_DIMENSION).toBe(16);
  }));
