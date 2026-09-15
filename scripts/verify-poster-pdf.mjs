#!/usr/bin/env node
// Poster PDF structure harness for Stemmagraph (S-10 U6), dev-only.
//
// Mirrors the verify-canvas-scale/verify-gedcom70 pattern:
//   (a) Dataset sintetis deterministik (seeded PRNG mulberry32):
//       satu pasangan akar, cabang bervariasi, target > 30 individu
//       tersebar minimal 3 generasi.
//   (b) Nama unicode wajib: satu nama aksara Jawa (blok U+A980..U+A9DF)
//       dan satu nama latin extended diacritics (Latin Extended-A),
//       plus satu nama aksara Bali sebagai bonus cakupan font U3.
//   (c) Renderer asli (src/lib/poster/) dibundle on-the-fly dengan
//       esbuild dari node_modules (tanpa dependency baru). Font Noto OFL
//       dibaca dari public/fonts dan diinjeksikan lewat opsi renderer
//       (jalur Node harness, bukan fetch browser).
//   (d) Verifikasi struktur dengan pdf-lib load balik per pilihan
//       kertas (A4 dan A1): tepat 1 halaman, ukuran halaman sesuai
//       mm kertas terpilih (toleransi 0.5 pt), minimal 1 font embedded,
//       dan ukuran byte < 5 MB.
//
// Exit code 0 = semua assertion lulus.

import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const WORK_DIR = join(SCRIPT_DIR, '.verify-poster-work')
const FONTS_DIR = join(ROOT, 'public', 'fonts')

/** Batas ukuran file poster menurut AC U6. */
const MAX_BYTES = 5 * 1024 * 1024
/** Toleransi konversi mm ke pt saat membandingkan ukuran halaman. */
const SIZE_TOL_PT = 0.5
const PT_PER_MM = 72 / 25.4

let passedCount = 0
let failedCount = 0

const check = (label, ok, detail = '') => {
  if (ok) {
    passedCount++
    console.log(`  PASS ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failedCount++
    console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`)
  }
}

const section = (title) => console.log(`\n== ${title}`)

// ---- Deterministic seeded PRNG (mulberry32) ---------------------------

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Dataset sintetis ---------------------------------------------------

/** Nama aksara Jawa (Sekar) untuk cakupan glyph U+A980..U+A9DF. */
const JAVANESE_NAME = 'ꦱꦼꦏꦂ'
/** Nama latin extended diacritics (a-akut, r-caron: Latin Extended-A). */
const LATIN_EXTENDED_NAME = 'Lukáš Dvořák'
/** Nama aksara Bali (Suyini) sebagai bonus cakupan blok U+1B00..U+1B7F. */
const BALINESE_NAME = 'ᬲᬸᬬᬶ'

const isJavaneseText = (text) =>
  /[\u{A980}-\u{A9DF}]/u.test(text)
const isBalineseText = (text) =>
  /[\u{1B00}-\u{1B7F}]/u.test(text)
const isLatinExtendedText = (text) =>
  /[\u{0100}-\u{017F}]/u.test(text)

let memberSeq = 0
const mkMember = (generation, parentIds, name) => ({
  id: `p${++memberSeq}`,
  name,
  nickname: undefined,
  birthDate: '1990-01-01',
  gender: memberSeq % 2 === 0 ? 'male' : 'female',
  isAlive: true,
  generation,
  maritalStatus: 'married',
  parentIds,
})

/**
 * Pohon sintetis satu pasangan akar, deterministik, target individu
 * ditentukan pemanggil. Mirip data hidrasi store asli: relasi ortu
 * terisi dua arah (parentIds pada anak, childrenIds pada ortu).
 * Tiga slot nama khusus dipasang pada anak generasi 2 (Jawa),
 * generasi 3 (latin extended), dan generasi 4 (Bali) agar setiap
 * skrip teruji pada baris layout yang beda.
 */
const generatePosterTree = (targetCount, seed) => {
  const rng = mulberry32(seed)
  memberSeq = 0
  const members = []
  const byId = new Map()
  const addChild = (kid, parentIds) => {
    kid.parentIds = parentIds
    members.push(kid)
    byId.set(kid.id, kid)
    for (const pid of parentIds) {
      const parent = byId.get(pid)
      parent.childrenIds = [...(parent.childrenIds ?? []), kid.id]
    }
  }
  const root = mkMember(1, [], 'Purnama')
  const spouse = mkMember(1, [], 'Purnama')
  root.spouseId = spouse.id
  spouse.spouseId = root.id
  members.push(root, spouse)
  byId.set(root.id, root)
  byId.set(spouse.id, spouse)

  // Slot nama unicode: ( nama, generasi target, sudah terpakai )
  const slots = [
    { name: JAVANESE_NAME, generation: 2, used: false },
    { name: LATIN_EXTENDED_NAME, generation: 3, used: false },
    { name: BALINESE_NAME, generation: 4, used: false },
  ]

  const frontier = [root]
  while (members.length < targetCount && frontier.length > 0) {
    const node = frontier.shift()
    let kids = Math.floor(rng() * 4)
    if (frontier.length === 0 && kids === 0) kids = 1
    for (let i = 0; i < kids && members.length < targetCount; i++) {
      const gen = node.generation + 1
      const slot = slots.find((s) => !s.used && s.generation === gen)
      const kid = mkMember(
        gen,
        [],
        slot ? ((slot.used = true), slot.name) : `Purnama ${memberSeq + 1}`
      )
      addChild(kid, [node.id])
      frontier.push(kid)
    }
  }
  return members
}

// ---- Font bundle dari disk (jalur Node harness) ------------------------

const readFontBundle = () => ({
  latin: new Uint8Array(
    readFileSync(join(FONTS_DIR, 'NotoSans', 'NotoSans-Regular.ttf'))
  ),
  javanese: new Uint8Array(
    readFileSync(join(FONTS_DIR, 'NotoSansJavanese', 'NotoSansJavanese-Regular.ttf'))
  ),
  balinese: new Uint8Array(
    readFileSync(join(FONTS_DIR, 'NotoSansBalinese', 'NotoSansBalinese-Regular.ttf'))
  ),
})

// ---- Verifikasi struktur via pdf-lib load balik ------------------------

/**
 * FontDescriptor sebuah font halaman. Font subset TrueType pdf-lib
 * bertipe Type0: descriptor-nya berada di DescendantFonts[0]
 * (CIDFontType2), bukan di dict induknya.
 */
const findFontDescriptor = (font) => {
  // Lookup bertipe di pdf-lib melempar saat objek absen, jadi pakai
  // lookup polos lalu periksa instanceof sendiri.
  const direct = font.lookup(PDFName.of('FontDescriptor'))
  if (direct instanceof PDFDict) return direct
  const descendants = font.lookup(PDFName.of('DescendantFonts'))
  if (descendants instanceof PDFArray) {
    const first = descendants.lookup(0)
    if (first instanceof PDFDict) {
      const descriptor = first.lookup(PDFName.of('FontDescriptor'))
      if (descriptor instanceof PDFDict) return descriptor
    }
  }
  return undefined
}

/**
 * Inventaris font halaman. Catatan perilaku pdf-lib 1.17.1: setiap
 * drawText mendaftarkan ALIAS kunci resource baru (TODO di pustaka
 * mereka) yang menunjuk objek font yang sama, jadi jumlah kunci bisa
 * jauh melebihi jumlah font. Program font unik didedupe lewat nama
 * BaseFont agar angka yang dilaporkan jujur.
 */
const pageFontInfo = (pdf) => {
  const resources = pdf.getPage(0).node.Resources()
  const fontValue = resources ? resources.lookup(PDFName.of('Font')) : undefined
  const fontDict = fontValue instanceof PDFDict ? fontValue : undefined
  if (!fontDict) return { aliases: 0, programs: new Set() }
  const programs = new Set()
  for (const [, value] of fontDict.entries()) {
    const font = value instanceof PDFRef ? pdf.context.lookup(value) : value
    if (!(font instanceof PDFDict)) continue
    const descriptor = findFontDescriptor(font)
    if (!descriptor || descriptor.lookup(PDFName.of('FontFile2')) == null) {
      continue
    }
    const baseFont = font.lookup(PDFName.of('BaseFont'))
    programs.add(baseFont ? baseFont.toString() : '/Unknown')
  }
  return { aliases: fontDict.entries().length, programs }
}

const verifyStructure = async (label, bytes, paper) => {
  section(`verifikasi struktur ${label}`)
  check(
    `${label}: ukuran byte < 5 MB`,
    bytes.byteLength < MAX_BYTES,
    `${(bytes.byteLength / 1024).toFixed(1)} KB`
  )
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  check(`${label}: tepat 1 halaman`, pdf.getPageCount() === 1, `pages=${pdf.getPageCount()}`)
  const { width, height } = pdf.getPage(0).getSize()
  const expectW = paper.widthMm * PT_PER_MM
  const expectH = paper.heightMm * PT_PER_MM
  check(
    `${label}: lebar halaman sesuai kertas`,
    Math.abs(width - expectW) < SIZE_TOL_PT,
    `${width.toFixed(2)} pt vs ${expectW.toFixed(2)} pt (${paper.kind} ${paper.widthMm} mm)`
  )
  check(
    `${label}: tinggi halaman sesuai kertas`,
    Math.abs(height - expectH) < SIZE_TOL_PT,
    `${height.toFixed(2)} pt vs ${expectH.toFixed(2)} pt (${paper.kind} ${paper.heightMm} mm)`
  )
  const { aliases, programs } = pageFontInfo(pdf)
  const names = [...programs].join(', ')
  check(
    `${label}: minimal 1 font embedded`,
    programs.size >= 1,
    `programUnik=${programs.size} (alias kunci=${aliases}): ${names}`
  )
  check(
    `${label}: font aksara Jawa ter-embed`,
    [...programs].some((n) => n.includes('NotoSansJavanese'))
  )
  check(
    `${label}: font aksara Bali ter-embed`,
    [...programs].some((n) => n.includes('NotoSansBalinese'))
  )
}

// ---- Main --------------------------------------------------------------

const main = async () => {
  console.log('verify-poster-pdf: S-10 U6 harness (dev-only)')
  rmSync(WORK_DIR, { recursive: true, force: true })
  mkdirSync(WORK_DIR, { recursive: true })

  const entry = join(WORK_DIR, 'entry.ts')
  writeFileSync(
    entry,
    [
      `export { buildPosterSpec } from '../../src/lib/poster/buildSpec.ts'`,
      `export { renderPosterPdf } from '../../src/lib/poster/renderer.ts'`,
      `export { ISO_PAPER_SIZES_MM, DEFAULT_PAPER_KIND } from '../../src/lib/poster/geometry.ts'`,
    ].join('\n')
  )

  const outfile = join(WORK_DIR, 'poster-render.bundle.mjs')
  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    })
    const { buildPosterSpec, renderPosterPdf, ISO_PAPER_SIZES_MM, DEFAULT_PAPER_KIND } =
      await import(outfile)

    section('dataset sintetis')
    const members = generatePosterTree(42, 20260819)
    const generations = new Set(members.map((m) => m.generation))
    check('jumlah individu > 30', members.length > 30, `count=${members.length}`)
    check('minimal 3 generasi', generations.size >= 3, `generations=${generations.size}`)
    check(
      'memuat satu nama aksara Jawa',
      members.some((m) => isJavaneseText(m.name))
    )
    check(
      'memuat satu nama latin extended diacritics',
      members.some((m) => isLatinExtendedText(m.name))
    )
    check(
      'memuat satu nama aksara Bali (bonus)',
      members.some((m) => isBalineseText(m.name))
    )

    const fonts = readFontBundle()
    const cases = [
      { label: 'A4', kind: 'a4' },
      { label: 'A1 (default UI)', kind: DEFAULT_PAPER_KIND },
    ]
    for (const testCase of cases) {
      const paper = {
        kind: testCase.kind,
        widthMm: ISO_PAPER_SIZES_MM[testCase.kind][0],
        heightMm: ISO_PAPER_SIZES_MM[testCase.kind][1],
      }
      const spec = buildPosterSpec({
        members,
        paper,
        title: 'Keluarga Purnama (harness)',
      })
      check(
        `spec ${testCase.label}: semua individu punya posisi`,
        spec.individuals.length === members.length &&
          Object.keys(spec.positions).length === members.length,
        `individuals=${spec.individuals.length}, positions=${Object.keys(spec.positions).length}`
      )
      check(
        `spec ${testCase.label}: ada konektor orang tua ke anak`,
        spec.connectors.length > 0,
        `connectors=${spec.connectors.length}`
      )
      const { pdfBytes, warnings } = await renderPosterPdf(spec, { fonts })
      check(
        `render ${testCase.label}: tanpa peringatan font`,
        !warnings.some((w) => w.code === 'missing-font-glyphs'),
        `warnings=${warnings.length}`
      )
      await verifyStructure(testCase.label, pdfBytes, paper)
    }
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  console.log(
    `\nhasil: ${passedCount} lulus, ${failedCount} gagal` +
      (failedCount === 0 ? ' (semua assertion OK)' : ' (ADA KEGAGALAN)')
  )
  if (failedCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error('verify-poster-pdf crash:', err)
  process.exit(1)
})
