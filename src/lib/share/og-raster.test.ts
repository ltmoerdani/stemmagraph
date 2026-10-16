// Guards for the ADR 0010 raster upgrade: the pure raster module, the
// format flag resolution, and the fallback contract. The binding tests
// skip cleanly when @resvg/resvg-js is not installed (it is an
// optionalDependency, so npm ci without platform bindings must pass).

import { describe, expect, it, vi } from 'vitest';
import {
  buildOgImageResponse,
  OG_RASTER_HEIGHT,
  OG_RASTER_WIDTH,
  OgRasterUnavailable,
  ogSvgToPng,
  resolveOgFormat,
} from './og-raster';
import { buildShareOgImageSvg, SHARE_OG_IMAGE_HEIGHT, SHARE_OG_IMAGE_WIDTH } from './og-image';

// PNG layout: 8-byte signature, then the IHDR chunk (length, type at
// bytes 12..16, width at 16, height at 20, both big-endian).
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function hasResvgBinding(): Promise<boolean> {
  try {
    await import('@resvg/resvg-js');
    return true;
  } catch {
    return false;
  }
}

const HAS_BINDING = await hasResvgBinding();

const sampleSvg = buildShareOgImageSvg({ title: 'Keluarga Besar Contoh', subtitle: 'Stemmagraph' });

describe('resolveOgFormat', () => {
  it('nilai png saja yang membuka jalur raster', () => {
    expect(resolveOgFormat('png')).toBe('png');
  });

  it('default dan nilai lain tetap svg byte-identik v1', () => {
    expect(resolveOgFormat(undefined)).toBe('svg');
    expect(resolveOgFormat('')).toBe('svg');
    expect(resolveOgFormat('PNG')).toBe('svg');
    expect(resolveOgFormat('raster')).toBe('svg');
  });
});

describe('ogSvgToPng with native binding', () => {
  it.skipIf(!HAS_BINDING)('merender PNG sungguhan signature dan IHDR 1200x630', async () => {
    const png = await ogSvgToPng(sampleSvg);
    expect(png.byteLength).toBeGreaterThan(0);
    const bytes = Buffer.from(png);
    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(bytes.readUInt32BE(16)).toBe(OG_RASTER_WIDTH);
    expect(bytes.readUInt32BE(20)).toBe(OG_RASTER_HEIGHT);
  });

  it.skipIf(!HAS_BINDING)('ukuran mengikuti konstanta og-image, bukan literal baru', () => {
    expect(OG_RASTER_WIDTH).toBe(SHARE_OG_IMAGE_WIDTH);
    expect(OG_RASTER_HEIGHT).toBe(SHARE_OG_IMAGE_HEIGHT);
  });

  it.skipIf(!HAS_BINDING)('SVG rusak melempar OgRasterUnavailable bukan error mentah', async () => {
    await expect(ogSvgToPng('<svg><unclosed>')).rejects.toBeInstanceOf(OgRasterUnavailable);
  });
});

describe('buildOgImageResponse routing', () => {
  const raster = vi.fn(async () => new Uint8Array([1, 2, 3]));

  it('format svg tidak memanggil raster sama sekali', async () => {
    const image = await buildOgImageResponse(sampleSvg, 'svg', raster);
    expect(raster).not.toHaveBeenCalled();
    expect(image.kind).toBe('svg');
    expect(image.contentType).toBe('image/svg+xml');
    expect(image.kind === 'svg' && image.body).toBe(sampleSvg);
  });

  it('format png memanggil raster sekali dan membungkus PNG', async () => {
    const image = await buildOgImageResponse(sampleSvg, 'png', raster);
    expect(raster).toHaveBeenCalledTimes(1);
    expect(image.kind).toBe('png');
    expect(image.contentType).toBe('image/png');
    expect(image.kind === 'png' && Buffer.compare(image.body, Buffer.from([1, 2, 3]))).toBe(0);
  });

  it('fallback: raster OgRasterUnavailable jatuh ke SVG 200 tanpa melempar', async () => {
    const failing = vi.fn(async () => {
      throw new OgRasterUnavailable('binding missing');
    });
    const image = await buildOgImageResponse(sampleSvg, 'png', failing);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(image.kind).toBe('svg');
    expect(image.kind === 'svg' && image.body).toBe(sampleSvg);
  });

  it('error non-unavailable dari raster diteruskan, bukan ditelan', async () => {
    const exploding = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(buildOgImageResponse(sampleSvg, 'png', exploding)).rejects.toThrow('boom');
  });
});

describe('OgRasterUnavailable identity', () => {
  it('membawa nama dan pesan yang jujur', () => {
    const err = new OgRasterUnavailable('reason-x');
    expect(err.name).toBe('OgRasterUnavailable');
    expect(err.message).toContain('OG rasterization unavailable');
    expect(err instanceof Error).toBe(true);
  });
});
