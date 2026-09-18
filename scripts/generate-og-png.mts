// Generates the static site OG image (public/og-image.png) from the
// dynamic SVG builder in src/lib/share/og-image.ts, so the static asset
// and the /api/v1/share/:token/og-image endpoint stay visually aligned.
//
// Run with: node_modules/.bin/tsx scripts/generate-og-png.mts
// resvg is a build-only dependency installed with --no-save on purpose:
// the shipped site only needs the produced PNG.

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { buildShareOgImageSvg, SHARE_OG_IMAGE_HEIGHT, SHARE_OG_IMAGE_WIDTH } from '../src/lib/share/og-image.ts';

const repoRoot = join(import.meta.dirname, '..');
const outputDir = join(repoRoot, 'public');
const outputPath = join(outputDir, 'og-image.png');
const fontsDir = join(repoRoot, 'public', 'fonts');

// Collect every bundled Noto ttf (Latin, Balinese, Javanese) so titles in
// local scripts render as glyphs instead of tofu boxes.
const fontFiles: string[] = [];
for (const familyDir of readdirSync(fontsDir)) {
  const familyPath = join(fontsDir, familyDir);
  if (!statSync(familyPath).isDirectory()) continue;
  for (const file of readdirSync(familyPath)) {
    if (file.toLowerCase().endsWith('.ttf')) fontFiles.push(join(familyPath, file));
  }
}

const svg = buildShareOgImageSvg({
  title: 'Stemmagraph',
  subtitle: 'Open-Source Family Tree Platform',
});

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: SHARE_OG_IMAGE_WIDTH },
  font: {
    fontFiles,
    loadSystemFonts: false,
    // The builder styles text as system-ui, sans-serif; map that generic
    // family to the bundled Noto Sans.
    defaultFontFamily: 'Noto Sans',
  },
});

const png = resvg.render().asPng();

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, png);

const kilobytes = png.byteLength / 1024;
console.log(`Wrote ${outputPath} (${kilobytes.toFixed(1)} KiB)`);
if (kilobytes >= 300) {
  console.error('PNG exceeds the 300 KiB budget');
  process.exitCode = 1;
}
