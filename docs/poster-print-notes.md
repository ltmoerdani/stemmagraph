# Poster Print Notes: Bleed, Safe Margin, and Color

> **Status**: 🟢 Active
> **Topic**: Print-shop handoff notes for the vector poster PDF (S-10)
> **Applies to**: `src/lib/poster/geometry.ts`, `src/lib/poster/palette.ts`, `src/lib/poster/renderer.ts`

## Geometry

The exported PDF is a single sheet at the exact chosen paper size (ISO A4,
A3, A2, A1, A0, or custom width and height; default A1). All coordinates are
points (1/72 inch), the native PDF unit, and all content is vector: text,
rectangles, and line segments only.

Two safety zones are baked into every sheet:

1. Bleed: 0.125 inch (3.175 mm) per side. Drawn as a light trim-frame
   decorator inside the page plus corner crop marks, so the shop can align
   the cut without guessing.
2. Safe margin: 10 mm per side, on top of the bleed. Family content (node
   boxes, names, connectors, title) is scaled and centered to fit inside
   this area; nothing important can fall into the guillotine zone.

The layout scale is computed once from the node bounding box: uniform scale,
no distortion, small extra gap (2 mm) so boxes never touch the safe-margin
line. When a title is present, an extra 20 mm of headroom is reserved above
the tree block.

## Color

The palette in `src/lib/poster/palette.ts` is flat RGB (sRGB hex tokens):
solid fills and hairline strokes. No gradients, no transparency, no effects
that stress a print RIP.

Full CMYK conversion is deliberately left to the print shop. The RGB values
avoid neon hues, so a standard conversion profile (for example US Web
Coated SWOP or ISO Coated v2) maps them to predictable CMYK builds. If the
shop needs exact brand colors, they should convert from the hex values in
the palette file, not from a screenshot.

## Fonts

Fonts are embedded subsets of local OFL Noto builds; see
[fonts-ofl.md](./fonts-ofl.md). The PDF carries every glyph it draws, so
Javanese and Balinese names print correctly even on machines without those
fonts installed. There are no font references that require a network fetch.

## Checklist for the shop

- Print at 100% scale ("actual size"), not "fit to page".
- Trim on the crop marks; the bleed frame keeps edge content safe.
- One sheet per poster: the renderer never produces multi-page packages.
