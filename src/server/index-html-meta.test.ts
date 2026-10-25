/**
 * Test dedikasi v396 AC2: meta referrer no-referrer di index.html root.
 *
 * Header Referrer-Policy menangani respons API ICS (AC1); meta tag ini
 * lapisan kedua untuk dokumen SPA itu sendiri sehingga URL address bar
 * tidak dikirim sebagai Referer saat browser memuat resource luar.
 *
 * Dibaca sebagai file langsung (bukan parse DOM) karena suite memakai
 * environment node; asersi string cukup untuk mengunci kontrak meta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const INDEX_HTML = fileURLToPath(new URL('../../index.html', import.meta.url));
const META = '<meta name="referrer" content="no-referrer" />';

describe('index.html meta referrer (v396 AC2)', () => {
  const html = readFileSync(INDEX_HTML, 'utf-8');

  it('memuat meta name=referrer content=no-referrer persis', () => {
    expect(html).toContain(META);
  });

  it('meta berada di dalam head, bukan di luar head', () => {
    const headOpen = html.indexOf('<head>');
    const headClose = html.indexOf('</head>');
    const metaIdx = html.indexOf(META);
    expect(headOpen).toBeGreaterThanOrEqual(0);
    expect(headClose).toBeGreaterThan(headOpen);
    expect(metaIdx).toBeGreaterThan(headOpen);
    expect(metaIdx).toBeLessThan(headClose);
  });
});
