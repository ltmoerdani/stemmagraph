import { describe, expect, it } from 'vitest';
import {
  buildShareOgImageSvg,
  escapeXmlText,
  SHARE_OG_IMAGE_HEIGHT,
  SHARE_OG_IMAGE_WIDTH,
  SHARE_OG_TITLE_MAX_CHARS,
} from './og-image';

describe('escapeXmlText', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeXmlText(`a & b <c> "d" 'e'`)).toBe(
      'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeXmlText('Keluarga Santoso 2026')).toBe('Keluarga Santoso 2026');
  });
});

describe('buildShareOgImageSvg', () => {
  it('renders the standard Open Graph canvas', () => {
    const svg = buildShareOgImageSvg({ title: 'Keluarga Santoso' });
    expect(svg).toContain(`width="${SHARE_OG_IMAGE_WIDTH}"`);
    expect(svg).toContain(`height="${SHARE_OG_IMAGE_HEIGHT}"`);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains the title text', () => {
    const svg = buildShareOgImageSvg({ title: 'Keluarga Santoso', subtitle: 'Stemmagraph' });
    expect(svg).toContain('Keluarga Santoso');
    expect(svg).toContain('Stemmagraph');
  });

  it('escapes user content so titles cannot inject markup', () => {
    const svg = buildShareOgImageSvg({ title: '<script>alert(1)</script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('escapes quotes and ampersands in the title', () => {
    const svg = buildShareOgImageSvg({ title: 'A & "B" Family' });
    expect(svg).toContain('A &amp; &quot;B&quot; Family');
  });

  it('wraps a long title into at most three lines', () => {
    const svg = buildShareOgImageSvg({ title: 'Keluarga Besar '.repeat(12) });
    const titleLines = svg.match(/class="title">/g) ?? [];
    expect(titleLines.length).toBeLessThanOrEqual(3);
  });

  it('caps the title at the documented character limit with an ellipsis', () => {
    const svg = buildShareOgImageSvg({ title: 'x'.repeat(SHARE_OG_TITLE_MAX_CHARS + 40) });
    expect(svg).toContain('\u2026');
  });

  it('omits the subtitle when it is missing or blank', () => {
    const withSubtitle = buildShareOgImageSvg({ title: 'T', subtitle: '  ' });
    expect(withSubtitle).not.toContain('class="subtitle"');
    const withoutSubtitle = buildShareOgImageSvg({ title: 'T' });
    expect(withoutSubtitle).not.toContain('class="subtitle"');
  });

  it('never lets non-string input crash the builder', () => {
    const svg = buildShareOgImageSvg({
      title: 42 as unknown as string,
      subtitle: 7 as unknown as string,
    });
    expect(svg).toContain('<svg');
  });
});
