// Audit v265 ACTIVATE CLEANUP: service worker hasil build wajib membersihkan
// cache versi lama saat siklus activate lewat cleanupOutdatedCaches, dengan
// dukungan caches.keys plus caches.delete di runtime workbox, aktif segera
// via skipWaiting plus clientsClaim, dan tetap memakai fallback navigasi
// index.html dari v264. Test-only: nihil perubahan konfigurasi. Artefak dist
// dihasilkan "npm run build" sebelum test (pola CI, gate menjalankan build dulu).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '..', '..', 'dist');
const SW_PATH = join(DIST, 'sw.js');

function loadSw(): string {
  if (!existsSync(SW_PATH)) {
    throw new Error('dist/sw.js tidak ada: jalankan "npm run build" sebelum test audit PWA');
  }
  return readFileSync(SW_PATH, 'utf8');
}

function loadWorkbox(): string {
  const files = readdirSync(DIST).filter(
    (f) => f.startsWith('workbox-') && f.endsWith('.js'),
  );
  if (files.length === 0) {
    throw new Error('dist tanpa chunk workbox: jalankan "npm run build" sebelum test audit PWA');
  }
  return files.map((f) => readFileSync(join(DIST, f), 'utf8')).join('\n');
}

describe('pwa activate cleanup audit (v265)', () => {
  let sw = '';
  let workbox = '';

  beforeAll(() => {
    sw = loadSw();
    workbox = loadWorkbox();
  });

  it('dist memuat sw.js dan chunk workbox hasil build', () => {
    expect(existsSync(SW_PATH)).toBe(true);
    expect(workbox.length).toBeGreaterThan(0);
  });

  it('sw.js memanggil cleanupOutdatedCaches saat activate', () => {
    expect(sw).toMatch(/cleanupOutdatedCaches\s*\(\s*\)/);
  });

  it('runtime workbox menelusuri cache lama via caches.keys', () => {
    expect(workbox).toMatch(/caches\s*\.\s*keys\s*\(/);
  });

  it('runtime workbox menghapus cache lama via caches.delete', () => {
    expect(workbox).toMatch(/caches\s*\.\s*delete\s*\(/);
  });

  it('sw.js aktif segera via skipWaiting', () => {
    expect(sw).toMatch(/skipWaiting\s*\(/);
  });

  it('sw.js mengambil kendali client via clientsClaim', () => {
    expect(sw).toMatch(/clientsClaim\s*\(\s*\)/);
  });

  it('sw.js mempertahankan fallback navigasi index.html (regresi v264)', () => {
    expect(sw).toMatch(/NavigationRoute/);
    expect(sw).toMatch(/index\.html/);
  });
});
