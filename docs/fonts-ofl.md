# Poster Fonts: Local Noto OFL Bundle

> **Status**: 🟢 Active
> **Topic**: Font licensing, embedding, and subsetting for the vector poster renderer (S-10)
> **Applies to**: `src/lib/poster/`, `public/fonts/`, `scripts/verify-poster-pdf.mjs`

## What ships

The poster renderer embeds three Noto families, all licensed under the SIL
Open Font License 1.1:

| Family | File | Covers |
| --- | --- | --- |
| Noto Sans | `public/fonts/NotoSans/NotoSans-Regular.ttf` | Latin, Latin Extended (diacritics like ū, ń, è) |
| Noto Sans Javanese | `public/fonts/NotoSansJavanese/NotoSansJavanese-Regular.ttf` | Javanese script (aksara Jawa, U+A980 to U+A9DF) |
| Noto Sans Balinese | `public/fonts/NotoSansBalinese/NotoSansBalinese-Regular.ttf` | Balinese script (U+1B00 to U+1B7F) |

Each family directory carries its own `OFL.txt` copy of the license, as the
OFL requires when the font is redistributed.

## License obligations, in short

The SIL OFL 1.1 permits bundling, subsetting, and embedding in documents,
including commercial print output, without a fee. Two obligations matter
for this repo:

1. Keep the `OFL.txt` file next to the fonts when they are redistributed
   (done: one copy per family directory).
2. Do not sell the fonts by themselves, and keep the reserved names intact.
   The files keep their original `NotoSans*` names, unmodified.

Subsetting happens at PDF embed time via `@pdf-lib/fontkit` with
`subset: true`. Only the glyphs actually drawn end up inside the exported
PDF, so a poster with plain Latin names stays small even though the full
Javanese font is available in the bundle.

## How the fonts are loaded

No render-time fetch to the internet happens anywhere.

- Browser: `loadPosterFonts()` in `src/lib/poster/fonts.ts` fetches the
  files from the app's own origin under `/fonts/...`.
- Dev harness: `scripts/verify-poster-pdf.mjs` reads the same files from
  disk and injects the bytes through `RenderPosterOptions.fonts`, so the
  verification covers the exact bytes users get.

Source of the binaries: the Noto project (notofonts.github.io, hinted
static instances) fetched at build preparation time, commit-time artifacts
stored in this repository.

## Naming and glyph fallback

`splitScriptRuns()` in `src/lib/poster/fonts.ts` classifies each character
into one of three buckets: `latin`, `javanese`, or `balinese`. Mixed-script
names render as sequential runs, each measured and drawn with its own font.
If a script font is missing at render time, the renderer falls back to the
Latin face and reports a `missing-font-glyphs` warning instead of failing.
