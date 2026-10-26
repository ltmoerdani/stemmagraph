/**
 * Poster theme palettes (v404).
 *
 * Pure data only: flat sRGB hex strings, no gradients, no transparency,
 * no dependencies. The default palette copies the S-10 ivory values in
 * palette.ts EXACTLY (anti-regression: a theme test pins both sides), so
 * existing posters keep printing pixel-identical when no theme is picked.
 *
 * Batik and songket follow the same print discipline as palette.ts: values
 * stay well inside sRGB gamut so a standard US Web Coated conversion keeps
 * them predictable at the print shop.
 */

/** The seven color roles a poster theme must define. */
export interface PosterThemePalette {
  /** Page background. */
  pageBg: string;
  /** Node fill for all individuals. */
  nodeFill: string;
  /** Node border hairline. */
  nodeBorder: string;
  /** Name text. */
  nameText: string;
  /** Orthogonal connector strokes. */
  connector: string;
  /** Poster title text. */
  titleText: string;
  /** Trim-frame decorator drawn at the bleed boundary. */
  trimFrame: string;
}

/** Theme kinds exposed to the export dropdown. */
export type PosterThemeKind = 'default' | 'batik' | 'songket';

/** Default theme: the S-10 soft ivory, byte-identical to palette.ts. */
export const DEFAULT_POSTER_PALETTE: PosterThemePalette = {
  pageBg: '#FAF7F2',
  nodeFill: '#FFFFFF',
  nodeBorder: '#3A3A3A',
  nameText: '#1F2937',
  connector: '#8A8A8A',
  titleText: '#111111',
  trimFrame: '#D8D2C8',
};

/**
 * Batik theme: classic sogan court palette, aged cotton ground with
 * soga browns and a deep indigo ink for text.
 */
export const BATIK_POSTER_PALETTE: PosterThemePalette = {
  pageBg: '#F3EBD8',
  nodeFill: '#FBF6EA',
  nodeBorder: '#5C4423',
  nameText: '#2F2A1E',
  connector: '#8A6D3F',
  titleText: '#3B2B16',
  trimFrame: '#C9AE7E',
};

/**
 * Songket theme: Palembang loom palette, warm ivory ground with
 * maroon frames and old-gold threads.
 */
export const SONGKET_POSTER_PALETTE: PosterThemePalette = {
  pageBg: '#FBF6EA',
  nodeFill: '#FFFDF6',
  nodeBorder: '#7A1F2B',
  nameText: '#33121A',
  connector: '#A2542F',
  titleText: '#33121A',
  trimFrame: '#D9B96A',
};

/** Lookup used by the renderer; unknown kinds are a programming error. */
const POSTER_PALETTES: Record<PosterThemeKind, PosterThemePalette> = {
  default: DEFAULT_POSTER_PALETTE,
  batik: BATIK_POSTER_PALETTE,
  songket: SONGKET_POSTER_PALETTE,
};

/** Default theme id for the dropdown and the renderer fallback. */
export const DEFAULT_POSTER_THEME: PosterThemeKind = 'default';

/** Resolves a theme id into its palette. Throws on an unknown id. */
export function resolvePosterPalette(kind: PosterThemeKind): PosterThemePalette {
  const palette = POSTER_PALETTES[kind];
  if (!palette) throw new Error(`Unknown poster theme: ${kind}`);
  return palette;
}
