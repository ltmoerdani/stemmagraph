/**
 * Childless families (v353 fase i): modul PURE untuk breakdown
 * keluarga tanpa anak per kategori berlabel, pilar statistik pohon
 * VISION-stemmagraph. Jangkar: wt_statistic.php
 * getChildlessFamiliesDistribution (baris 1046) yang mendelegasikan
 * childrenRepository::childlessFamiliesDistribution. Rujukan pola,
 * bukan salinan kode. Tanpa import apa pun, tanpa I/O, tanpa
 * Date.now, tanpa random: murni transformasi array entri.
 *
 * Kontrak:
 *   computeChildlessFamilies(entries) mengembalikan total penjumlahan
 *   value dan daftar classes berisi label asli, value, serta kind
 *   sebagai padanan semantik properti class PHP jangkar yang terikat
 *   presentasi donut. Kind dipetakan dari label setelah normalisasi
 *   (lowercase, trim, collapse whitespace, tanda hubung jadi spasi):
 *   label berisi frasa have children / with children / has children
 *   = 'withChildren'; berisi childless tanpa kualifikasi itu
 *   = 'childless'; selain itu 'other'.
 *
 * Parsing strict pola v338-v352 (prefiks childless-families): input
 * bukan array, entri bukan objek ber-index, label bukan string atau
 * kosong, atau value bukan number bulat non-negatif DILEMPAR Error
 * ber-prefiks, bukan difilter diam-diam. Array kosong menghasilkan
 * total 0 dengan classes kosong tanpa throw.
 */

export interface ChildlessEntry {
  label: string
  value: number
}

export type ChildlessKind = 'childless' | 'withChildren' | 'other'

export interface ChildlessFamiliesResult {
  total: number
  classes: Array<{ label: string; value: number; kind: ChildlessKind }>
}

const ERROR_PREFIX = 'childless-families:'

/**
 * Normalisasi label: lowercase, tanda hubung jadi spasi, trim,
 * collapse whitespace berlebih.
 */
function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function classify(normalized: string): ChildlessKind {
  if (
    normalized.includes('have children') ||
    normalized.includes('with children') ||
    normalized.includes('has children')
  ) {
    return 'withChildren'
  }
  if (normalized.includes('childless')) {
    return 'childless'
  }
  return 'other'
}

/**
 * Hitung breakdown keluarga tanpa anak dari entri ber-label.
 * Melempar Error ber-prefiks childless-families: untuk setiap
 * pelanggaran kontrak input.
 */
export function computeChildlessFamilies(entries: unknown): ChildlessFamiliesResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX} input harus array`)
  }

  let total = 0
  const classes: ChildlessFamiliesResult['classes'] = []

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX} entri harus objek ber-index`)
    }

    const record = entry as Record<string, unknown>
    const { label, value } = record

    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new Error(`${ERROR_PREFIX} label harus string non-kosong`)
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`${ERROR_PREFIX} value harus number bulat non-negatif`)
    }

    classes.push({ label, value, kind: classify(normalizeLabel(label)) })
    total += value
  }

  return { total, classes }
}
