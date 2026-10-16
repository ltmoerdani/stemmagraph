// Audit v266 REGISTRATION LOCK: pendaftaran service worker hasil build wajib
// terkunci pada artefak yang benar. registerSW.js mendeteksi dukungan
// serviceWorker, menunggu event load, lalu mendaftarkan /sw.js dengan scope
// root. index.html wajib memuat injeksi skrip registerSW dan menautkan
// manifest.webmanifest. Manifest wajib membawa identitas aplikasi, scope
// standalone, serta ikon 192 dan 512 plus varian maskable (regresi v263).
// Test-only: nihil perubahan konfigurasi. Artefak dist dihasilkan
// "npm run build" sebelum test (pola v264/v265, gate menjalankan build dulu).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '..', '..', 'dist');
const SW_PATH = join(DIST, 'sw.js');
const REGISTER_PATH = join(DIST, 'registerSW.js');
const MANIFEST_PATH = join(DIST, 'manifest.webmanifest');
const INDEX_PATH = join(DIST, 'index.html');

function loadArtifact(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`dist/${label} tidak ada: jalankan "npm run build" sebelum test audit PWA`);
  }
  return readFileSync(path, 'utf8');
}

describe('pwa registration audit (v266)', () => {
  let sw = '';
  let register = '';
  let manifest = '';
  let index = '';

  beforeAll(() => {
    sw = loadArtifact(SW_PATH, 'sw.js');
    register = loadArtifact(REGISTER_PATH, 'registerSW.js');
    manifest = loadArtifact(MANIFEST_PATH, 'manifest.webmanifest');
    index = loadArtifact(INDEX_PATH, 'index.html');
  });

  it('dist memuat sw.js, registerSW.js, manifest.webmanifest, dan index.html', () => {
    expect(existsSync(SW_PATH)).toBe(true);
    expect(existsSync(REGISTER_PATH)).toBe(true);
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    expect(existsSync(INDEX_PATH)).toBe(true);
    expect(sw.length).toBeGreaterThan(0);
    expect(register.length).toBeGreaterThan(0);
  });

  it('registerSW.js mendeteksi dukungan serviceWorker di navigator', () => {
    expect(register).toMatch(/['"]serviceWorker['"]\s+in\s+navigator/);
  });

  it('registerSW.js menunggu event load window sebelum registrasi', () => {
    expect(register).toMatch(/window\s*\.\s*addEventListener\s*\(\s*['"]load['"]/);
  });

  it('registerSW.js mendaftarkan /sw.js dengan scope root', () => {
    expect(register).toMatch(/navigator\s*\.\s*serviceWorker\s*\.\s*register\s*\(\s*['"]\/sw\.js['"]/);
    expect(register).toMatch(/scope\s*:\s*['"]\/['"]/);
  });

  it('index.html memuat injeksi skrip registerSW (vite-plugin-pwa)', () => {
    expect(index).toMatch(/id="vite-plugin-pwa:register-sw"/);
    expect(index).toMatch(/<script[^>]*src="\/registerSW\.js"[^>]*>/);
  });

  it('index.html menautkan manifest.webmanifest via link rel manifest', () => {
    expect(index).toMatch(/<link[^>]*rel="manifest"[^>]*href="\/manifest\.webmanifest"[^>]*>/);
  });

  it('manifest.webmanifest membawa identitas dan mode standalone', () => {
    const parsed = JSON.parse(manifest) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      scope?: string;
    };
    expect(parsed.name).toBe('Stemmagraph');
    expect(parsed.short_name).toBe('Stemmagraph');
    expect(parsed.start_url).toBe('/');
    expect(parsed.display).toBe('standalone');
    expect(parsed.scope).toBe('/');
  });

  it('manifest.webmanifest mendeklarasikan ikon 192 dan 512 plus maskable (regresi v263)', () => {
    const parsed = JSON.parse(manifest) as { icons?: Array<{ src: string; sizes: string; purpose: string }> };
    const icons = parsed.icons ?? [];
    expect(icons.some((i) => i.sizes === '192x192' && i.purpose.includes('any'))).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose.includes('any'))).toBe(true);
    expect(icons.filter((i) => i.purpose.includes('maskable')).length).toBeGreaterThanOrEqual(2);
  });
});
