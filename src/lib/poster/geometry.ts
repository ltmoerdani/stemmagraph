/**
 * Pure geometry + scaling helpers for the poster renderer (S-10).
 *
 * No pdf-lib and no DOM here on purpose: every function is unit-testable in
 * plain Node. The renderer composes these helpers when placing content.
 *
 * Units:
 * - layout units: arbitrary numbers from the poster spec
 * - millimeters: ISO paper size vocabulary
 * - points: 1/72 inch, the native pdf-lib coordinate unit (origin at the
 *   bottom-left corner of the page, Y grows upward)
 */

import type { PosterNodePosition, PosterPaper, PosterPaperKind } from './types';

/** Millimeters per point (72 points per inch). */
export const PT_PER_MM = 72 / 25.4;

/** Bleed: 0.125 inch, as required by most print shops. */
export const BLEED_MM = 0.125 * 25.4;

/** Safe margin inside the trim edge that must stay clear of text. */
export const SAFE_MARGIN_MM = 10;

/** ISO A-series short dimensions in millimeters (width, height, portrait). */
export const ISO_PAPER_SIZES_MM: Record<
  Exclude<PosterPaperKind, 'custom'>,
  readonly [number, number]
> = {
  a4: [210, 297],
  a3: [297, 420],
  a2: [420, 594],
  a1: [594, 841],
  a0: [841, 1189],
};

/** Default paper for the poster export: A1, large enough for 3+ generations. */
export const DEFAULT_PAPER_KIND: Exclude<PosterPaperKind, 'custom'> = 'a1';

/** Paper presets exposed to the UI dropdown (technical labels, mm). */
export interface PaperPreset {
  kind: Exclude<PosterPaperKind, 'custom'>;
  widthMm: number;
  heightMm: number;
}

export const POSTER_PAPER_PRESETS: PaperPreset[] = (
  ['a4', 'a3', 'a2', 'a1', 'a0'] as const
).map((kind) => ({
  kind,
  widthMm: ISO_PAPER_SIZES_MM[kind][0],
  heightMm: ISO_PAPER_SIZES_MM[kind][1],
}));

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/**
 * Resolves a paper kind into concrete millimeter dimensions. Custom paper
 * needs both dimensions; width alone is rejected so no silent default can
 * distort the poster.
 */
export function resolvePaper(
  kind: PosterPaperKind,
  custom?: { widthMm: number; heightMm: number }
): PosterPaper {
  if (kind === 'custom') {
    if (!custom || custom.widthMm <= 0 || custom.heightMm <= 0) {
      throw new Error(
        'Custom paper requires positive widthMm and heightMm in millimeters'
      );
    }
    return { kind, widthMm: custom.widthMm, heightMm: custom.heightMm };
  }
  const [widthMm, heightMm] = ISO_PAPER_SIZES_MM[kind];
  return { kind, widthMm, heightMm };
}

/** Axis-aligned bounding box over node positions, in layout units. */
export interface LayoutBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function measureNodes(positions: PosterNodePosition[]): LayoutBox {
  if (positions.length === 0) {
    throw new Error('Cannot measure an empty node set');
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Everything the renderer needs to map layout units onto the page. */
export interface PagePlacement {
  pageWidthPt: number;
  pageHeightPt: number;
  /** Points per layout unit. Always positive. */
  scale: number;
  /** Page-space translation applied after scaling. */
  offsetXPt: number;
  offsetYPt: number;
  /** Trim box inside bleed, where family content must stay. */
  contentBoxPt: { x: number; y: number; width: number; height: number };
  /** Bleed frame drawn as a background decorator. */
  bleedPt: number;
  /** Total chrome (bleed + safe margin) per side, in points. */
  chromePt: number;
}

/**
 * Fits the layout bounding box inside the paper safe area and centers it.
 *
 * The safe area is the paper minus bleed (0.125 inch) minus the safe margin
 * on every side. Content is scaled uniformly (no distortion) with a small
 * gap so boxes never kiss the trim edge.
 */
export function computePlacement(
  paper: PosterPaper,
  content: LayoutBox,
  options?: {
    marginMm?: number;
    bleedMm?: number;
    gapMm?: number;
    /** Extra clear space above content, e.g. for the poster title. */
    extraTopMm?: number;
  }
): PagePlacement {
  const marginMm = options?.marginMm ?? SAFE_MARGIN_MM;
  const bleedMm = options?.bleedMm ?? BLEED_MM;
  const gapMm = options?.gapMm ?? 2;
  const extraTopPt = mmToPt(options?.extraTopMm ?? 0);
  if (content.width <= 0 || content.height <= 0) {
    throw new Error('Layout bounding box must have positive width and height');
  }

  const pageWidthPt = mmToPt(paper.widthMm);
  const pageHeightPt = mmToPt(paper.heightMm);
  const chromePt = mmToPt(marginMm + bleedMm);
  const gapPt = mmToPt(gapMm);
  const availW = pageWidthPt - 2 * chromePt - 2 * gapPt;
  const availH = pageHeightPt - 2 * chromePt - 2 * gapPt - extraTopPt;
  if (availW <= 0 || availH <= 0) {
    throw new Error('Paper too small for bleed plus safe margin');
  }

  const scale = Math.min(availW / content.width, availH / content.height);
  const drawnW = content.width * scale;
  const drawnH = content.height * scale;
  const leftPt = chromePt + gapPt + (availW - drawnW) / 2;
  const bottomPt = chromePt + gapPt + (availH - drawnH) / 2;

  return {
    pageWidthPt,
    pageHeightPt,
    scale,
    offsetXPt: leftPt - content.minX * scale,
    offsetYPt: bottomPt - content.minY * scale,
    contentBoxPt: {
      x: chromePt,
      y: chromePt,
      width: pageWidthPt - 2 * chromePt,
      height: pageHeightPt - 2 * chromePt,
    },
    bleedPt: mmToPt(bleedMm),
    chromePt,
  };
}

/** Maps a layout-space X to page-space points. */
export function layoutToPageX(x: number, placement: PagePlacement): number {
  return placement.offsetXPt + x * placement.scale;
}

/**
 * Maps a layout-space Y to page-space points.
 *
 * Layout space is screen-like: Y grows downward (generation 1 at the top),
 * while PDF page space grows upward from the bottom-left corner.
 */
export function layoutToPageY(y: number, placement: PagePlacement): number {
  return placement.pageHeightPt - (placement.offsetYPt + y * placement.scale);
}

export function layoutScale(v: number, placement: PagePlacement): number {
  return v * placement.scale;
}

/** Default name font sizing knobs (points, at final page scale). */
export const POSTER_NAME_FONT_PT = 9;
export const POSTER_NAME_MIN_PT = 4.5;
export const POSTER_TITLE_FONT_PT = 22;

/**
 * Measures a rendered string. Implementations wrap pdf-lib font.widthOfTextAtSize
 * or a stub in unit tests.
 */
export type FontMeasurer = (text: string, sizePt: number) => number;

export interface NameFit {
  sizePt: number;
  /** True when the base size had to be clamped down. */
  clamped: boolean;
  /** True when even the minimum size does not fit the box width. */
  overflow: boolean;
}

/**
 * Autoscales a name so it fits its node box. Steps down in 0.5 pt decrements
 * from basePt; stops at minPt. An overflow at minPt is reported (the harness
 * treats it as a warning, never a render failure).
 */
export function fitNameFont(
  text: string,
  measure: FontMeasurer,
  boxWidthPt: number,
  basePt: number = POSTER_NAME_FONT_PT,
  minPt: number = POSTER_NAME_MIN_PT
): NameFit {
  let sizePt = basePt;
  let clamped = false;
  while (sizePt > minPt && measure(text, sizePt) > boxWidthPt) {
    sizePt -= 0.5;
    clamped = true;
  }
  if (sizePt < minPt) sizePt = minPt;
  const overflow = measure(text, sizePt) > boxWidthPt;
  return { sizePt: overflow ? minPt : sizePt, clamped, overflow };
}

