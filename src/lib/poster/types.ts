/**
 * Pure data contract for the vector poster renderer (S-10).
 *
 * The renderer accepts ONLY this plain-data contract. It never touches the
 * live DOM, never screenshots, and performs no network requests. The UI layer
 * is responsible for assembling the spec from existing app state.
 *
 * Product decision note (Q4-a vs Q4-b): the current entry point derives node
 * positions automatically from family data ("auto-from-layout"). A future
 * editor mode where users drag poster boxes manually (Q4-b) would still feed
 * this same contract, so the renderer stays agnostic.
 */

/** ISO paper kinds supported by the poster renderer. */
export type PosterPaperKind = 'a4' | 'a3' | 'a2' | 'a1' | 'a0' | 'custom';

/** Resolved paper size in millimeters (width before height). */
export interface PosterPaper {
  kind: PosterPaperKind;
  /** Page width in millimeters. */
  widthMm: number;
  /** Page height in millimeters. */
  heightMm: number;
}

/** One individual as printed on the poster. */
export interface PosterIndividual {
  id: string;
  /** Display name exactly as it should print (unicode allowed). */
  name: string;
  /**
   * 1-based generation index. Generation 1 is the top row. Used by the
   * auto-layout builder; the renderer itself only reads positions.
   */
  generation: number;
}

/** Node box in layout units (arbitrary scale; mapped onto paper later). */
export interface PosterNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Orthogonal connector between a parent and a child box.
 *
 * Manual connector pattern (B1/B3): a vertical drop leaves the parent bottom
 * center, joins a horizontal child rail, then drops vertically into the child
 * top center. When `railY` is omitted the rail sits midway between the parent
 * bottom and the child top.
 */
export interface PosterConnector {
  parentId: string;
  childId: string;
  /** Y of the horizontal child rail in layout units. Optional. */
  railY?: number;
}

/**
 * Complete poster specification handed to the renderer.
 * Everything here is plain data: no DOM nodes, no live measurements.
 */
export interface PosterSpec {
  individuals: PosterIndividual[];
  /** Layout box per individual id. Every id must be present. */
  positions: Record<string, PosterNodePosition>;
  connectors: PosterConnector[];
  /** Optional poster title printed above the tree block. */
  title?: string;
  paper: PosterPaper;
  /**
   * Logical font family name resolved by the poster font registry,
   * e.g. 'noto-sans'. Defaults to 'noto-sans'.
   */
  fontFamilyName?: string;
}

/** Non-fatal problems surfaced by the renderer for harness/UI reporting. */
export interface PosterWarning {
  code:
    | 'name-too-small'
    | 'name-overflow'
    | 'missing-position'
    | 'missing-font-glyphs';
  individualId?: string;
  message: string;
}

/** Result of a successful render. */
export interface PosterRenderResult {
  pdfBytes: Uint8Array;
  warnings: PosterWarning[];
}
