/**
 * Test v398 AC6: modul pure photoFile (magic bytes + batas ukuran).
 * Fixture dibangun programatik dari header bytes, nihil file binari
 * di repo sesuai kontrak GOAL.
 */
import { describe, expect, it } from 'vitest';
import {
  PHOTO_MAX_BYTES,
  detectPhotoMime,
  validatePhotoUpload,
} from './photoFile';

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEAD = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

function bytesOf(head: number[], total = head.length): Uint8Array {
  const out = new Uint8Array(total);
  out.set(head, 0);
  return out;
}

describe('detectPhotoMime', () => {
  it('mengenali JPEG dari FFD8FF', () => {
    expect(detectPhotoMime(bytesOf(JPEG_HEAD))).toBe('image/jpeg');
  });

  it('mengenali PNG dari 89504E47', () => {
    expect(detectPhotoMime(bytesOf(PNG_HEAD))).toBe('image/png');
  });

  it('mengenali WebP dari RIFF....WEBP', () => {
    expect(detectPhotoMime(bytesOf(WEBP_HEAD))).toBe('image/webp');
  });

  it('menolak GIF meski berawalan teks gambar populer', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectPhotoMime(gif)).toBeNull();
  });

  it('menolak PDF', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectPhotoMime(pdf)).toBeNull();
  });

  it('menolak teks biasa', () => {
    const text = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(detectPhotoMime(text)).toBeNull();
  });

  it('menolak RIFF tanpa label WEBP (bukan WebP)', () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(detectPhotoMime(wav)).toBeNull();
  });

  it('menolak buffer terlalu pendek', () => {
    expect(detectPhotoMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectPhotoMime(new Uint8Array([]))).toBeNull();
  });
});

describe('validatePhotoUpload', () => {
  it('menerima JPEG kecil', () => {
    const r = validatePhotoUpload(bytesOf(JPEG_HEAD));
    expect(r).toEqual({ ok: true, mime: 'image/jpeg' });
  });

  it('menerima WebP kecil', () => {
    const r = validatePhotoUpload(bytesOf(WEBP_HEAD));
    expect(r).toEqual({ ok: true, mime: 'image/webp' });
  });

  it('menolak file kosong', () => {
    expect(validatePhotoUpload(new Uint8Array(0))).toEqual({
      ok: false,
      reason: 'EMPTY_FILE',
    });
  });

  it('menolak file melebihi 10 MB', () => {
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    big.set(PNG_HEAD, 0);
    expect(validatePhotoUpload(big)).toEqual({ ok: false, reason: 'TOO_LARGE' });
  });

  it('menerima file tepat 10 MB yang sah PNG', () => {
    const edge = new Uint8Array(PHOTO_MAX_BYTES);
    edge.set(PNG_HEAD, 0);
    const r = validatePhotoUpload(edge);
    expect(r).toEqual({ ok: true, mime: 'image/png' });
  });

  it('menolak isi bukan gambar meski ukuran wajar', () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(validatePhotoUpload(junk)).toEqual({
      ok: false,
      reason: 'NOT_AN_IMAGE',
    });
  });
});
