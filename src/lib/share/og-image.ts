// Dynamic OG image builder for public share links (ADR 0010).
//
// Pure, deterministic, zero dependencies: one SVG string in the standard
// 1200x630 Open Graph size, showing the tree title. The title is user
// content, so every text fragment goes through XML escaping and the
// title is wrapped and capped before it reaches the markup; SVG text
// injection is a real risk on a public endpoint. v1 ships SVG rather
// than a raster format because the pure-core tree carries no native
// image stack; several crawlers skip SVG og:image, and ADR 0010
// records that limitation with its upgrade path (rasterize this same
// output behind a flag).

/** Canvas size of the Open Graph image, the common crawler card size. */
export const SHARE_OG_IMAGE_WIDTH = 1200;
export const SHARE_OG_IMAGE_HEIGHT = 630;

/** Hard cap on the title before wrapping: long names lose the tail. */
export const SHARE_OG_TITLE_MAX_CHARS = 90;

/** Wrap layout: at most three lines of at most thirty characters. */
const TITLE_MAX_LINES = 3;
const TITLE_CHARS_PER_LINE = 30;

export interface ShareOgImageInput {
  /** Tree title (or generic label for password links). User content. */
  title: string
  /** Small line under the title, e.g. the product name. User content. */
  subtitle?: string
}

/**
 * Escapes a text fragment for XML (and therefore for HTML attributes
 * that use double quotes): & first, then the angle brackets, quotes,
 * and apostrophe.
 */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Folds a title into at most TITLE_MAX_LINES lines of at most
 * TITLE_CHARS_PER_LINE characters, breaking on whitespace when a word
 * boundary is near and hard-breaking words that exceed a line alone.
 * Anything past the last line is replaced with an ellipsis.
 */
function wrapTitle(raw: string): string[] {
  const trimmed = raw.trim();
  const capped = trimmed.slice(0, SHARE_OG_TITLE_MAX_CHARS).trimEnd();
  if (capped === '') return [''];
  // Content cut by the cap itself must also announce the truncation.
  const truncated = trimmed.length > SHARE_OG_TITLE_MAX_CHARS;

  const lines: string[] = [];
  for (const word of capped.split(/\s+/)) {
    // Hard-break a single word longer than one line.
    let rest = word;
    while (rest.length > TITLE_CHARS_PER_LINE) {
      if (lines.length === TITLE_MAX_LINES) return finishWithEllipsis(lines, true);
      lines.push(rest.slice(0, TITLE_CHARS_PER_LINE));
      rest = rest.slice(TITLE_CHARS_PER_LINE);
    }
    const current = lines[lines.length - 1];
    if (current !== undefined && current.length + 1 + rest.length <= TITLE_CHARS_PER_LINE) {
      lines[lines.length - 1] = `${current} ${rest}`;
    } else {
      if (lines.length === TITLE_MAX_LINES) return finishWithEllipsis(lines, true);
      lines.push(rest);
    }
  }
  return finishWithEllipsis(lines, truncated);
}

/** Replaces the tail of the last line with an ellipsis when content overflows. */
function finishWithEllipsis(lines: string[], overflow: boolean): string[] {
  if (!overflow || lines.length === 0) return lines;
  const last = lines[lines.length - 1];
  lines[lines.length - 1] = `${last.slice(0, Math.max(0, TITLE_CHARS_PER_LINE - 1)).trimEnd()}\u2026`;
  return lines;
}

/**
 * Builds the Open Graph SVG for one share link. Pure string output; the
 * caller decides the content type and cache headers.
 */
export function buildShareOgImageSvg(input: ShareOgImageInput): string {
  const title = typeof input.title === 'string' ? input.title : '';
  const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
  const lines = wrapTitle(title).map((line) => escapeXmlText(line));

  const lineHeight = 64;
  const baseY = 296 - ((lines.length - 1) * lineHeight) / 2;
  const titleMarkup = lines
    .map((line, index) => `<text x="80" y="${baseY + index * lineHeight}" class="title">${line}</text>`)
    .join('');
  const subtitleY = baseY + (lines.length - 1) * lineHeight + 64;
  const subtitleMarkup =
    subtitle === ''
      ? ''
      : `<text x="80" y="${subtitleY}" class="subtitle">${escapeXmlText(subtitle)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_OG_IMAGE_WIDTH}" height="${SHARE_OG_IMAGE_HEIGHT}" viewBox="0 0 ${SHARE_OG_IMAGE_WIDTH} ${SHARE_OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXmlText(title)}">`,
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#0f172a"/>',
    '<stop offset="1" stop-color="#1e3a5f"/>',
    '</linearGradient>',
    '</defs>',
    '<style>',
    '.title { font-family: system-ui, sans-serif; font-size: 54px; font-weight: 700; fill: #f8fafc; }',
    '.subtitle { font-family: system-ui, sans-serif; font-size: 30px; fill: #94a3b8; }',
    '.rule { stroke: #38bdf8; stroke-width: 4; }',
    '</style>',
    '<rect width="1200" height="630" fill="url(#bg)"/>',
    '<line x1="80" y1="180" x2="240" y2="180" class="rule"/>',
    titleMarkup,
    subtitleMarkup,
    '</svg>',
  ].join('');
}
