// Generator ikon PWA dari public/favicon.svg (v263 PWA ICONS).
// Render 4 PNG ke public/icons: pwa-192.png dan pwa-512.png (purpose any)
// plus pwa-maskable-192.png dan pwa-maskable-512.png (purpose maskable).
// Binding @resvg/resvg-js berstatus optionalDependency; importer dinamis
// dengan specifier non-literal mengikuti pola src/lib/share/og-raster.ts.
// Jalankan: node scripts/generate-pwa-icons.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESVG_SPECIFIER = '@resvg/resvg-js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const faviconPath = join(repoRoot, 'public', 'favicon.svg');
const iconsDir = join(repoRoot, 'public', 'icons');

const SIZES = [192, 512];
const MASKABLE_COLOR = '#16a34a';
// Skala 0.8 berpusat 16,16: konten pohon masuk zona aman maskable
// (lingkaran pusat 80 persen dari sisi terpendek kanvas).
const MASKABLE_SCALE = 0.8;
const MASKABLE_INSET = Number((16 * (1 - MASKABLE_SCALE)).toFixed(2));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Spesifier non-literal meniru og-raster.ts: tooling tidak menuntut
// modul saat binding opsional tidak terpasang.
async function loadResvg() {
  const mod = await import(/* @vite-ignore */ RESVG_SPECIFIER);
  if (!mod || typeof mod.Resvg !== 'function') {
    throw new Error('binding @resvg/resvg-js tidak bisa dimuat');
  }
  return mod.Resvg;
}

// Ambil konten pohon asli: isi di dalam <svg> favicon tanpa rect latar
// penuh kanvas, karena varian maskable menyediakan latar sendiri
// berupa kotak siku (tanpa rx) menutup seluruh kanvas.
function extractTreeContent(faviconSource) {
  const inner = faviconSource
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const withoutBackground = inner
    .replace(/<rect\s+width="32"\s+height="32"[^>]*\/>\s*/, '')
    .trim();
  if (withoutBackground.length === 0) {
    throw new Error('konten pohon favicon.svg kosong setelah latar dipisah');
  }
  return withoutBackground;
}

// SVG maskable dibangun berlapis: rect latar siku penuh 32x32, lalu
// konten pohon sebagai nested svg dengan translate+scale 0.8 berpusat
// 16,16 sehingga tidak ada area transparan di tepi kanvas.
function buildMaskableSvg(treeContent) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">',
    `  <rect width="32" height="32" fill="${MASKABLE_COLOR}"/>`,
    `  <svg viewBox="0 0 32 32" transform="translate(${MASKABLE_INSET} ${MASKABLE_INSET}) scale(${MASKABLE_SCALE})">`,
    `    ${treeContent}`,
    '  </svg>',
    '</svg>',
    '',
  ].join('\n');
}

function renderPng(Resvg, svg, size) {
  const instance = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return Buffer.from(instance.render().asPng());
}

// Verifikasi saat produksi: signature PNG dan dims IHDR persis.
function assertPng(bytes, label, expectedSize) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${label}: signature PNG tidak valid`);
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${label}: chunk IHDR tidak ditemukan`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`${label}: dims ${width}x${height}, diharapkan ${expectedSize}x${expectedSize}`);
  }
}

async function main() {
  const Resvg = await loadResvg();
  const favicon = readFileSync(faviconPath, 'utf8');
  const maskableSvg = buildMaskableSvg(extractTreeContent(favicon));

  const outputs = [];
  for (const size of SIZES) {
    outputs.push({ file: `pwa-${size}.png`, svg: favicon, size });
    outputs.push({ file: `pwa-maskable-${size}.png`, svg: maskableSvg, size });
  }

  mkdirSync(iconsDir, { recursive: true });
  const written = new Map();
  for (const out of outputs) {
    const png = renderPng(Resvg, out.svg, out.size);
    assertPng(png, out.file, out.size);
    writeFileSync(join(iconsDir, out.file), png);
    written.set(out.file, png);
  }

  // Setiap maskable wajib berbeda bytes dari pasangan any-nya.
  for (const size of SIZES) {
    if (written.get(`pwa-${size}.png`).equals(written.get(`pwa-maskable-${size}.png`))) {
      throw new Error(`pwa-maskable-${size}.png identik dengan varian any`);
    }
  }

  for (const [file, png] of written) {
    console.log(`${file}: ${png.length} bytes`);
  }
}

main().catch((error) => {
  console.error(`gagal: ${error.message}`);
  process.exit(1);
});
