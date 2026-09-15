/**
 * Print-aware poster palette (S-10).
 *
 * Flat RGB tokens only: solid fills, hairline strokes, no gradients and no
 * transparency, which keeps the file friendly for print RIP processors.
 *
 * CMYK note: full CMYK conversion is left to the print shop. The RGB values
 * below are chosen to stay well inside sRGB gamut so a standard US Web
 * Coated profile conversion keeps them predictable (no neon hues that shift
 * badly). See docs/poster-print-notes.md for the shop handoff notes.
 */
import { rgb } from 'pdf-lib';

/** Page background: soft ivory instead of pure white to reduce glare. */
export const PAGE_BG = '#FAF7F2';
/** Node fill for all individuals. */
export const NODE_FILL = '#FFFFFF';
/** Node border hairline. */
export const NODE_BORDER = '#3A3A3A';
/** Name text. */
export const NAME_TEXT = '#1F2937';
/** Orthogonal connector strokes. */
export const CONNECTOR = '#8A8A8A';
/** Poster title text. */
export const TITLE_TEXT = '#111111';
/** Trim-frame decorator drawn at the bleed boundary. */
export const TRIM_FRAME = '#D8D2C8';

/** Parses #RRGGBB into a pdf-lib rgb() color. */
export function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid poster palette hex: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return rgb(
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255
  );
}
