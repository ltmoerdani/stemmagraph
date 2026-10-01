import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Karakterisasi konfigurasi PWA di vite.config.ts. Berkas dibaca sebagai teks
// dari disk (tanpa import) agar tidak memicu efek samping path saat testing.

const CONFIG_PATH = fileURLToPath(
  new URL('../../vite.config.ts', import.meta.url),
);

let raw = '';
let code = '';
let pwaBlock = '';

function stripLineComments(text: string): string {
  return text.replace(/^\s*\/\/.*$/gm, '');
}

function extractPwaBlock(text: string): string {
  const start = text.indexOf('VitePWA({');
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + 'VitePWA('.length; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return '';
}

function globExtensions(block: string): string[] {
  const arr = /globPatterns:\s*\[([^\]]*)\]/.exec(block);
  if (!arr) return [];
  const braces = /\{([^}]*)\}/.exec(arr[1]);
  if (!braces) return [];
  return braces[1].split(',').map((s) => s.trim());
}

describe('PWA offline fallback: karakterisasi vite.config.ts', () => {
  beforeAll(async () => {
    raw = await readFile(CONFIG_PATH, 'utf8');
    code = stripLineComments(raw);
    pwaBlock = extractPwaBlock(code);
  });

  it('blok VitePWA ditemukan di konfigurasi', () => {
    expect(pwaBlock.length).toBeGreaterThan(0);
    expect(pwaBlock).toContain('workbox');
    expect(pwaBlock).toContain('manifest');
  });

  it('navigateFallback bernilai /index.html (appshell offline)', () => {
    expect(pwaBlock).toMatch(/navigateFallback:\s*'\/index\.html'/);
  });

  it('maximumFileSizeToCacheInBytes bernilai 3 * 1024 * 1024 (3145728)', () => {
    const m = /maximumFileSizeToCacheInBytes:\s*([^,\n]+),?/.exec(pwaBlock);
    expect(m).not.toBeNull();
    const expr = (m as RegExpExecArray)[1].replace(/\s+/g, '');
    expect(expr).toBe('3*1024*1024');
    expect(3 * 1024 * 1024).toBe(3145728);
  });

  it('komentar menjelaskan alasan limit precache 3 MB (bundle utama 2,7 MB)', () => {
    expect(raw).toMatch(/Bundle utama hasil build[^\n]*2,7 MB[^\n]*limit precache/);
  });

  it('globPatterns memuat lima ekstensi js,css,html,svg,woff2', () => {
    expect(pwaBlock).toContain("'**/*.{js,css,html,svg,woff2}'");
    const exts = globExtensions(pwaBlock);
    expect(exts).toEqual(['js', 'css', 'html', 'svg', 'woff2']);
  });

  it('manifest memuat name, display, dan theme_color yang benar', () => {
    expect(pwaBlock).toMatch(/name:\s*'Stemmagraph'/);
    expect(pwaBlock).toMatch(/display:\s*'standalone'/);
    expect(pwaBlock).toMatch(/theme_color:\s*'#16a34a'/);
  });

  it('theme_color manifest konsisten dengan meta theme-color index.html', async () => {
    const html = await readFile(
      fileURLToPath(new URL('../../index.html', import.meta.url)),
      'utf8',
    );
    const meta = /<meta\s+name="theme-color"\s+content="([^"]+)"/.exec(html);
    expect(meta).not.toBeNull();
    expect((meta as RegExpExecArray)[1]).toBe('#16a34a');
  });

  it("registerType bernilai 'autoUpdate' (SW update otomatis)", () => {
    expect(pwaBlock).toMatch(/registerType:\s*'autoUpdate'/);
  });

  it('includeAssets memuat favicon.svg', () => {
    expect(pwaBlock).toMatch(/includeAssets:\s*\[[^\]]*'favicon\.svg'[^\]]*\]/);
  });

  it('kebijakan offline appshell-only: komentar menolak cache respons API dan globPatterns tanpa json', () => {
    expect(raw).toContain('service worker tidak meng-cache respons API');
    const exts = globExtensions(pwaBlock);
    expect(exts.length).toBeGreaterThan(0);
    expect(exts).not.toContain('json');
  });

  it('tidak ada navigateFallbackDenylist yang memblokir fallback navigasi SPA', () => {
    expect(pwaBlock).not.toContain('navigateFallbackDenylist');
    expect(pwaBlock).not.toMatch(/Denylist[^\n]*index\.html/);
  });
});
