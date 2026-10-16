// Audit v264 OFFLINE UX: service worker hasil build wajib memuat app shell
// di precache manifest, mendaftar fallback navigasi ke index.html, dan
// manifest web ter-parse sebagai JSON valid dengan ikon lengkap v263.
// Test-only: nihil perubahan konfigurasi. Artefak dist dihasilkan
// "npm run build" (gate QA menjalankan build sebelum test, pola CI).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '..', '..', 'dist');
const SW_PATH = join(DIST, 'sw.js');
const MANIFEST_PATH = join(DIST, 'manifest.webmanifest');

function loadSw(): string {
  if (!existsSync(SW_PATH)) {
    throw new Error('dist/sw.js tidak ada: jalankan "npm run build" sebelum test audit PWA');
  }
  return readFileSync(SW_PATH, 'utf8');
}

function precacheUrls(sw: string): string[] {
  const start = sw.indexOf('precacheAndRoute([');
  expect(start, 'sw.js wajib memanggil precacheAndRoute').toBeGreaterThanOrEqual(0);
  const urls: string[] = [];
  const re = /url:"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sw)) !== null) urls.push(m[1]);
  return urls;
}

describe('v264 audit: precache app shell', () => {
  it('dist/sw.js ada (hasil npm run build)', () => {
    expect(existsSync(SW_PATH)).toBe(true);
  });

  it('sw.js memuat precacheAndRoute (workbox precache aktif)', () => {
    expect(loadSw()).toContain('precacheAndRoute');
  });

  it('precache manifest memuat index.html (app shell entry)', () => {
    expect(precacheUrls(loadSw())).toContain('index.html');
  });

  it('precache manifest memuat registerSW.js (wiring plugin PWA live)', () => {
    expect(precacheUrls(loadSw())).toContain('registerSW.js');
  });

  it('precache manifest signifikan (minimal 10 entri shell)', () => {
    expect(precacheUrls(loadSw()).length).toBeGreaterThanOrEqual(10);
  });

  it('semua entri precache punya revision (string) atau null, format valid', () => {
    const sw = loadSw();
    const re = /\{url:"([^"]+)",revision:("[a-f0-9]+"|null)\}/g;
    let count = 0;
    while (re.exec(sw) !== null) count += 1;
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it('favicon.svg diprecache (aset shell svg)', () => {
    expect(precacheUrls(loadSw())).toContain('favicon.svg');
  });

  it('bundle JS di assets/ diprecache (globPatterns js tercover)', () => {
    expect(precacheUrls(loadSw()).some((u) => u.startsWith('assets/'))).toBe(true);
  });
});

describe('v264 audit: fallback navigasi offline', () => {
  it('sw.js memakai NavigationRoute (workbox routing navigasi)', () => {
    expect(loadSw()).toContain('NavigationRoute');
  });

  it('fallback navigasi terikat ke /index.html (createHandlerBoundToURL)', () => {
    expect(loadSw()).toContain('createHandlerBoundToURL("/index.html")');
  });

  it('rute navigasi terdaftar via registerRoute', () => {
    expect(loadSw()).toContain('registerRoute');
  });
});

describe('v264 audit: manifest web parse JSON', () => {
  const manifest: Record<string, unknown> = JSON.parse(
    (() => {
      if (!existsSync(MANIFEST_PATH)) {
        throw new Error('dist/manifest.webmanifest tidak ada: jalankan "npm run build"');
      }
      return readFileSync(MANIFEST_PATH, 'utf8');
    })(),
  );

  it('manifest ter-parse sebagai JSON murni dengan name dan short_name', () => {
    expect(manifest['name']).toBe('Stemmagraph');
    expect(manifest['short_name']).toBe('Stemmagraph');
  });

  it('start_url dan display standalone (syarat installability)', () => {
    expect(manifest['start_url']).toBe('/');
    expect(manifest['display']).toBe('standalone');
  });

  it('lima ikon lengkap: PNG 192 dan 512 purpose any plus maskable (regresi v263)', () => {
    const icons = manifest['icons'] as Array<{ src: string; sizes: string; purpose: string }>;
    expect(icons).toHaveLength(5);
    const pngs = icons.filter((i) => i.src.endsWith('.png'));
    expect(pngs).toHaveLength(4);
    expect(pngs.filter((i) => i.purpose === 'any').map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    expect(pngs.filter((i) => i.purpose === 'maskable').map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
  });

  it('empat ikon PNG ikut diprecache via includeAssets (ikon tampil offline)', () => {
    const pngs = precacheUrls(loadSw()).filter((u) => u.startsWith('icons/'));
    expect(pngs.sort()).toEqual([
      'icons/pwa-192.png',
      'icons/pwa-512.png',
      'icons/pwa-maskable-192.png',
      'icons/pwa-maskable-512.png',
    ]);
  });
});
