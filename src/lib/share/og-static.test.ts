// Guards for the static site OG image set: the generated PNG asset, the
// static meta tags in index.html, and the boundary between the static
// asset and the dynamic /api/v1/share/:token/og-image endpoint.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '../../..');
const pngBytes = readFileSync(join(repoRoot, 'public', 'og-image.png'));
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');

// PNG layout: 8-byte signature, then the IHDR chunk (length, type at
// bytes 12..16, width at 16, height at 20, both big-endian).
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('static OG image asset', () => {
  it('is a real PNG with 1200x630 dimensions read from IHDR', () => {
    expect(pngBytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(pngBytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(pngBytes.readUInt32BE(16)).toBe(1200);
    expect(pngBytes.readUInt32BE(20)).toBe(630);
  });
});

describe('static OG meta in index.html', () => {
  it('points og:image at the versioned asset with declared dimensions', () => {
    const ogImage = indexHtml.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(ogImage).toBeDefined();
    expect(ogImage).toContain('og-image.png?v=');
    expect(indexHtml).toMatch(/property="og:image:width" content="1200"/);
    expect(indexHtml).toMatch(/property="og:image:height" content="630"/);
  });

  it('declares the summary_large_image twitter card', () => {
    expect(indexHtml).toMatch(/name="twitter:card" content="summary_large_image"/);
  });

  it('keeps the static og:image and the dynamic share endpoint separate', () => {
    const ogImage = indexHtml.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(ogImage).toBeDefined();
    // Crawlers get the static asset only; the dynamic endpoint stays on
    // its own route and must never leak into the static meta.
    expect(ogImage).not.toContain('/api/');
    expect(ogImage).not.toContain('og-image.svg');
  });
});
