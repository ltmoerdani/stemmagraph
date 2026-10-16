// Guards v263 PWA ICONS: keempat PNG committed di public/icons wajib
// PNG valid (signature 89504e47), dims IHDR persis 192 dan 512, dan
// tiap varian maskable berbeda bytes dari pasangan any-nya. Kasus yang
// butuh binding native skip bersih bila @resvg/resvg-js tidak terpasang
// (optionalDependency, pola og-raster.test.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ICONS_DIR = join(import.meta.dirname, '..', '..', 'public', 'icons');
const ICON_FILES = [
  { file: 'pwa-192.png', size: 192 },
  { file: 'pwa-512.png', size: 512 },
  { file: 'pwa-maskable-192.png', size: 192 },
  { file: 'pwa-maskable-512.png', size: 512 },
] as const;

async function hasResvgBinding(): Promise<boolean> {
  try {
    await import('@resvg/resvg-js');
    return true;
  } catch {
    return false;
  }
}

const HAS_BINDING = await hasResvgBinding();

describe('ikon PWA committed', () => {
  it.each(ICON_FILES)('$file berformat PNG signature 89504e47', ({ file }) => {
    const bytes = readFileSync(join(ICONS_DIR, file));
    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  it.each(ICON_FILES)('$file dims IHDR persis ukuran nama', ({ file, size }) => {
    const bytes = readFileSync(join(ICONS_DIR, file));
    expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  });

  it('maskable 192 beda bytes dari varian any-nya', () => {
    const anyPng = readFileSync(join(ICONS_DIR, 'pwa-192.png'));
    const maskable = readFileSync(join(ICONS_DIR, 'pwa-maskable-192.png'));
    expect(maskable.equals(anyPng)).toBe(false);
  });

  it('maskable 512 beda bytes dari varian any-nya', () => {
    const anyPng = readFileSync(join(ICONS_DIR, 'pwa-512.png'));
    const maskable = readFileSync(join(ICONS_DIR, 'pwa-maskable-512.png'));
    expect(maskable.equals(anyPng)).toBe(false);
  });

  it.skipIf(!HAS_BINDING)('binding resvg merender favicon.svg ke PNG 192 konsisten aset', async () => {
    const mod = (await import(/* @vite-ignore */ '@resvg/resvg-js')) as {
      Resvg: new (svg: string, options?: { fitTo?: { mode: 'width'; value: number } }) => {
        render(): { asPng(): Uint8Array }
      }
    };
    const favicon = readFileSync(join(ICONS_DIR, '..', 'favicon.svg'), 'utf8');
    const png = Buffer.from(new mod.Resvg(favicon, { fitTo: { mode: 'width', value: 192 } }).render().asPng());
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(png.readUInt32BE(16)).toBe(192);
    expect(png.readUInt32BE(20)).toBe(192);
  });
});
