/**
 * Vector poster renderer core (S-10).
 *
 * Draws a single-sheet family tree poster as a true vector PDF via pdf-lib:
 * node boxes, autoscaled names, orthogonal connectors (manual B1/B3 pattern)
 * and an optional title. The input is the pure PosterSpec contract; there is
 * no DOM access, no html2canvas, no screenshots and no network calls beyond
 * same-origin font assets.
 */

import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import {
  computePlacement,
  fitNameFont,
  layoutToPageX,
  layoutToPageY,
  layoutScale,
  measureNodes,
  mmToPt,
  POSTER_TITLE_FONT_PT,
} from './geometry';
import { loadPosterFonts, splitScriptRuns, type PosterFontBundle } from './fonts';
import {
  CONNECTOR,
  NAME_TEXT,
  NODE_BORDER,
  NODE_FILL,
  PAGE_BG,
  TITLE_TEXT,
  TRIM_FRAME,
  hexToRgb,
} from './palette';
import type {
  PosterNodePosition,
  PosterRenderResult,
  PosterSpec,
  PosterWarning,
} from './types';

/** Injectable knobs; the dev harness passes explicit fonts and a title gap. */
export interface RenderPosterOptions {
  /** Font bytes; defaults to the local OFL Noto bundle under public/fonts. */
  fonts?: PosterFontBundle;
  /** Extra clear millimeters above content when a title is drawn. */
  titleGapMm?: number;
}

/** Extra headroom reserved for the title line, in millimeters. */
const DEFAULT_TITLE_GAP_MM = 20;

/** Inner padding between node border and name text, in points. */
const NAME_PAD_PT = 2;

/** Node border hairline weight, in points. */
const NODE_BORDER_PT = 0.75;

/** Connector stroke weight, in points. */
const CONNECTOR_PT = 0.6;

interface ScriptFonts {
  latin: PDFFont;
  javanese?: PDFFont;
  balinese?: PDFFont;
}

function pickFont(
  script: 'latin' | 'javanese' | 'balinese',
  fonts: ScriptFonts
): PDFFont {
  if (script === 'javanese') return fonts.javanese ?? fonts.latin;
  if (script === 'balinese') return fonts.balinese ?? fonts.latin;
  return fonts.latin;
}

/** Total width of a mixed-script name at one size. */
function measureRuns(
  name: string,
  fonts: ScriptFonts,
  sizePt: number
): number {
  let width = 0;
  for (const run of splitScriptRuns(name)) {
    width += pickFont(run.script, fonts).widthOfTextAtSize(run.text, sizePt);
  }
  return width;
}

/** Draws a mixed-script name centered inside its node box. */
function drawName(
  page: PDFPage,
  name: string,
  fonts: ScriptFonts,
  boxX: number,
  boxBottomY: number,
  boxWidth: number,
  boxHeight: number
): void {
  const available = boxWidth - 2 * NAME_PAD_PT;
  const measure = (text: string, sizePt: number) =>
    measureRuns(text, fonts, sizePt);
  const fit = fitNameFont(name, measure, available);
  const totalWidth = measure(name, fit.sizePt);
  let cursorX = boxX + (boxWidth - totalWidth) / 2;
  const baselineY =
    boxBottomY + (boxHeight - fit.sizePt) / 2 + fit.sizePt * 0.18;
  for (const run of splitScriptRuns(name)) {
    page.drawText(run.text, {
      x: cursorX,
      y: baselineY,
      size: fit.sizePt,
      font: pickFont(run.script, fonts),
      color: hexToRgb(NAME_TEXT),
    });
    cursorX += pickFont(run.script, fonts).widthOfTextAtSize(
      run.text,
      fit.sizePt
    );
  }
}

/** Draws one orthogonal connector: parent drop, child rail, child drop. */
function drawConnector(
  page: PDFPage,
  placement: ReturnType<typeof computePlacement>,
  parent: PosterNodePosition,
  child: PosterNodePosition,
  railY: number
): void {
  const pTopX = layoutToPageX(parent.x + parent.width / 2, placement);
  const pBottomY = layoutToPageY(parent.y + parent.height, placement);
  const cTopX = layoutToPageX(child.x + child.width / 2, placement);
  const cTopY = layoutToPageY(child.y, placement);
  const railPageY = layoutToPageY(railY, placement);
  const stroke = { color: hexToRgb(CONNECTOR), thickness: CONNECTOR_PT };
  // Parent bottom drops down to the rail.
  page.drawLine({
    start: { x: pTopX, y: pBottomY },
    end: { x: pTopX, y: railPageY },
    ...stroke,
  });
  // Horizontal rail shared by all children of this parent.
  page.drawLine({
    start: { x: pTopX, y: railPageY },
    end: { x: cTopX, y: railPageY },
    ...stroke,
  });
  // Final vertical drop into the child top.
  page.drawLine({
    start: { x: cTopX, y: railPageY },
    end: { x: cTopX, y: cTopY },
    ...stroke,
  });
}

/** Background chrome: page fill plus a trim-frame decorator at the bleed. */
function drawPageChrome(
  page: PDFPage,
  placement: ReturnType<typeof computePlacement>
): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: placement.pageWidthPt,
    height: placement.pageHeightPt,
    color: hexToRgb(PAGE_BG),
  });
  // Trim frame marks the 0.125 inch bleed boundary as a background decorator.
  page.drawRectangle({
    x: placement.bleedPt,
    y: placement.bleedPt,
    width: placement.pageWidthPt - 2 * placement.bleedPt,
    height: placement.pageHeightPt - 2 * placement.bleedPt,
    borderColor: hexToRgb(TRIM_FRAME),
    borderWidth: 0.5,
  });
}

/**
 * Renders the poster spec into PDF bytes.
 *
 * Warnings (names clamped below readability, overflow, missing positions)
 * are returned, never thrown: they are harness/UI signals, not failures.
 */
export async function renderPosterPdf(
  spec: PosterSpec,
  options: RenderPosterOptions = {}
): Promise<PosterRenderResult> {
  const warnings: PosterWarning[] = [];

  // Validate positions up front; individuals without a box are skipped with
  // a warning instead of aborting the whole poster.
  const placed = spec.individuals.filter((ind) => {
    const has = spec.positions[ind.id] != null;
    if (!has) {
      warnings.push({
        code: 'missing-position',
        individualId: ind.id,
        message: `No layout position for ${ind.name}; node skipped`,
      });
    }
    return has;
  });
  if (placed.length === 0) {
    throw new Error('Poster spec has no individuals with positions');
  }
  const positions = placed.map((ind) => spec.positions[ind.id]);
  const content = measureNodes(positions);
  const hasTitle = typeof spec.title === 'string' && spec.title.trim() !== '';
  const placement = computePlacement(spec.paper, content, {
    extraTopMm: hasTitle
      ? (options.titleGapMm ?? DEFAULT_TITLE_GAP_MM)
      : 0,
  });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // Font strategy: injected bundle (harness), then the local public/fonts
  // bundle (browser). A standard Helvetica fallback is dev convenience only;
  // the harness always runs with the real bundle so OFL Noto is what ships.
  let bundle: PosterFontBundle | undefined = options.fonts;
  if (!bundle) {
    bundle = await loadPosterFonts().catch(() => undefined);
  }
  let fonts: ScriptFonts;
  if (bundle && bundle.latin.length > 0) {
    fonts = {
      latin: await pdf.embedFont(bundle.latin, { subset: true }),
      javanese: bundle.javanese
        ? await pdf.embedFont(bundle.javanese, { subset: true })
        : undefined,
      balinese: bundle.balinese
        ? await pdf.embedFont(bundle.balinese, { subset: true })
        : undefined,
    };
  } else {
    warnings.push({
      code: 'missing-font-glyphs',
      message:
        'Local Noto fonts unavailable; fell back to Helvetica (dev only)',
    });
    fonts = { latin: await pdf.embedFont(StandardFonts.Helvetica) };
  }

  const page = pdf.addPage([placement.pageWidthPt, placement.pageHeightPt]);
  drawPageChrome(page, placement);

  if (hasTitle) {
    let titleSize = POSTER_TITLE_FONT_PT;
    const availWidth = placement.contentBoxPt.width;
    while (
      titleSize > 8 &&
      measureRuns(spec.title as string, fonts, titleSize) > availWidth
    ) {
      titleSize -= 1;
    }
    const titleWidth = measureRuns(spec.title as string, fonts, titleSize);
    let cursorX = (placement.pageWidthPt - titleWidth) / 2;
    const baselineY =
      placement.pageHeightPt -
      placement.chromePt -
      mmToPt(4) -
      titleSize * 0.8;
    for (const run of splitScriptRuns(spec.title as string)) {
      const font = pickFont(run.script, fonts);
      page.drawText(run.text, {
        x: cursorX,
        y: baselineY,
        size: titleSize,
        font,
        color: hexToRgb(TITLE_TEXT),
      });
      cursorX += font.widthOfTextAtSize(run.text, titleSize);
    }
  }

  // Connectors first so node boxes draw on top of the rail joints.
  const byId = new Map(placed.map((ind) => [ind.id, ind]));
  for (const conn of spec.connectors) {
    const parent = byId.get(conn.parentId);
    const child = byId.get(conn.childId);
    if (!parent || !child) continue;
    const parentPos = spec.positions[conn.parentId];
    const childPos = spec.positions[conn.childId];
    const parentBottom = parentPos.y + parentPos.height;
    const clampedRail =
      conn.railY == null
        ? (parentBottom + childPos.y) / 2
        : Math.min(Math.max(conn.railY, parentBottom), childPos.y);
    drawConnector(page, placement, parentPos, childPos, clampedRail);
  }

  for (const ind of placed) {
    const pos = spec.positions[ind.id];
    const boxX = layoutToPageX(pos.x, placement);
    const boxBottomY = layoutToPageY(pos.y + pos.height, placement);
    const boxWidth = layoutScale(pos.width, placement);
    const boxHeight = layoutScale(pos.height, placement);
    page.drawRectangle({
      x: boxX,
      y: boxBottomY,
      width: boxWidth,
      height: boxHeight,
      color: hexToRgb(NODE_FILL),
      borderColor: hexToRgb(NODE_BORDER),
      borderWidth: NODE_BORDER_PT,
    });
    drawName(page, ind.name, fonts, boxX, boxBottomY, boxWidth, boxHeight);

    const available = boxWidth - 2 * NAME_PAD_PT;
    const measure = (text: string, sizePt: number) =>
      measureRuns(text, fonts, sizePt);
    const fit = fitNameFont(ind.name, measure, available);
    if (fit.overflow) {
      warnings.push({
        code: 'name-overflow',
        individualId: ind.id,
        message: `Name "${ind.name}" still overflows its box at minimum size`,
      });
    } else if (fit.clamped) {
      warnings.push({
        code: 'name-too-small',
        individualId: ind.id,
        message: `Name "${ind.name}" clamped below base size for legibility`,
      });
    }
  }

  const pdfBytes = await pdf.save();
  return { pdfBytes, warnings };
}

// Re-export rgb for callers building custom overlays; keeps pdf-lib imports
// in one place.
export { rgb };
