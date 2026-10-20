/**
 * Couple age-gap distribution (v318 fase i): modul PURE untuk histogram
 * dua sisi selisih usia pasangan, pilar 2 VISION-stemmagraph. Jangkar:
 * wt_statistic.php getCoupleAgeGapDistribution (MarriageRepository::
 * ageGapDistribution), band magnitude dua arah (left suami lebih tua,
 * right istri lebih tua). Tanpa import server/, tanpa prisma, tanpa
 * fetch: murni transformasi array pasangan menjadi histogram.
 *
 * DEFINISI: gap = selisih mutlak tahun lahir kedua pasangan (EXACT
 * lengkap y+m+d, kedua tahun > 0). Tahun lahir sama masuk field equal
 * di band '0-2', bukan left/right, supaya bentuk {left,right,equal}
 * seragam di semua band dan konsumen UI fase iii tidak perlu guard.
 *
 * Penyaringan PER PASANGAN (bukan per pohon):
 *   - Salah satu birthDate null, atau dateKind bukan EXACT, atau ada
 *     komponen y/m/d null: pasangan di-skip.
 *   - yearStart salah satu <= 0: pasangan di-skip (guard domain BCE).
 *
 * Semantik output: nihil pasangan valid tetap mengembalikan objek
 * 6 band dengan semua count 0 (histogram, bukan scalar null).
 *
 * Parser strict (pola v308): parseCoupleAgeGapPairs LEMPAR Error
 * dengan indeks dan nama field saat payload salah, DILARANG
 * silent-filter.
 *
 * Deterministik: agregasi setelah sort pairId ascending sehingga
 * urutan input tidak mengubah hasil.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface CoupleAgeGapDate {
  /** "EXACT" untuk tanggal pasti; kind lain mengecualikan pasangan. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface CoupleAgeGapSpouse {
  id: string
  birthDate: CoupleAgeGapDate | null
}

export interface CoupleAgeGapPair {
  pairId: string
  spouseA: CoupleAgeGapSpouse
  spouseB: CoupleAgeGapSpouse
}

export interface CoupleAgeGapBucket {
  /** Pasangan dengan suami (spouseA) lahir LEBIH AWAL (lebih tua). */
  left: number
  /** Pasangan dengan istri (spouseB) lahir LEBIH AWAL (lebih tua). */
  right: number
  /** Pasangan dengan tahun lahir sama persis; hanya terisi di '0-2'. */
  equal: number
}

/** Kunci band urut sesuai kontrak; bentuk output stabil. */
export const COUPLE_AGE_GAP_BANDS = [
  '0-2',
  '3-5',
  '6-10',
  '11-15',
  '16-20',
  '21+',
] as const

export type CoupleAgeGapBand = (typeof COUPLE_AGE_GAP_BANDS)[number]

export type CoupleAgeGapDistribution = Record<CoupleAgeGapBand, CoupleAgeGapBucket>

/** Tanggal EXACT dengan komponen kalender lengkap dan tahun > 0. */
function exactBirthYear(date: CoupleAgeGapDate | null): number | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  if (monthStart < 1 || monthStart > 12) return null
  if (dayStart < 1 || dayStart > 31) return null
  if (yearStart <= 0) return null
  return yearStart
}

/** Band magnitude untuk gap > 0 (equal ditangani terpisah). */
function bandForGap(gap: number): CoupleAgeGapBand {
  if (gap <= 2) return '0-2'
  if (gap <= 5) return '3-5'
  if (gap <= 10) return '6-10'
  if (gap <= 15) return '11-15'
  if (gap <= 20) return '16-20'
  return '21+'
}

function emptyDistribution(): CoupleAgeGapDistribution {
  return {
    '0-2': { left: 0, right: 0, equal: 0 },
    '3-5': { left: 0, right: 0, equal: 0 },
    '6-10': { left: 0, right: 0, equal: 0 },
    '11-15': { left: 0, right: 0, equal: 0 },
    '16-20': { left: 0, right: 0, equal: 0 },
    '21+': { left: 0, right: 0, equal: 0 },
  }
}

/**
 * Histogram dua sisi selisih usia pasangan. Deterministik: pasangan
 * diproses terurut pairId ascending.
 */
export function computeCoupleAgeGapDistribution(
  pairs: CoupleAgeGapPair[],
): CoupleAgeGapDistribution {
  const distribution = emptyDistribution()
  const sorted = [...pairs].sort((a, b) => (a.pairId < b.pairId ? -1 : a.pairId > b.pairId ? 1 : 0))
  for (const pair of sorted) {
    const yearA = exactBirthYear(pair.spouseA.birthDate)
    const yearB = exactBirthYear(pair.spouseB.birthDate)
    if (yearA === null || yearB === null) continue
    if (yearA === yearB) {
      distribution['0-2'].equal += 1
      continue
    }
    const gap = Math.abs(yearA - yearB)
    const band = bandForGap(gap)
    if (yearA < yearB) {
      distribution[band].left += 1
    } else {
      distribution[band].right += 1
    }
  }
  return distribution
}

/** Validasi satu pasangan; lempar Error dengan indeks dan field. */
function assertPair(raw: unknown, index: number): CoupleAgeGapPair {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`couple age gap pair[${index}]: bukan objek`)
  }
  const record = raw as Record<string, unknown>
  if (typeof record.pairId !== 'string') {
    throw new Error(`couple age gap pair[${index}].pairId: hilang atau bukan string`)
  }
  return {
    pairId: record.pairId,
    spouseA: assertSpouse(record.spouseA, index, 'spouseA'),
    spouseB: assertSpouse(record.spouseB, index, 'spouseB'),
  }
}

function assertSpouse(raw: unknown, index: number, role: string): CoupleAgeGapSpouse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`couple age gap pair[${index}].${role}: hilang atau bukan objek`)
  }
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string') {
    throw new Error(`couple age gap pair[${index}].${role}.id: hilang atau bukan string`)
  }
  const birthDate = record.birthDate
  if (birthDate === null) {
    return { id: record.id, birthDate: null }
  }
  if (typeof birthDate !== 'object') {
    throw new Error(`couple age gap pair[${index}].${role}.birthDate: bukan objek atau null`)
  }
  const dateRecord = birthDate as Record<string, unknown>
  for (const field of ['dateKind', 'yearStart', 'monthStart', 'dayStart'] as const) {
    if (!(field in dateRecord)) {
      throw new Error(`couple age gap pair[${index}].${role}.birthDate.${field}: hilang`)
    }
  }
  if (typeof dateRecord.dateKind !== 'string') {
    throw new Error(`couple age gap pair[${index}].${role}.birthDate.dateKind: bukan string`)
  }
  for (const field of ['yearStart', 'monthStart', 'dayStart'] as const) {
    const value = dateRecord[field]
    if (value !== null && typeof value !== 'number') {
      throw new Error(`couple age gap pair[${index}].${role}.birthDate.${field}: bukan number atau null`)
    }
  }
  return {
    id: record.id,
    birthDate: {
      dateKind: dateRecord.dateKind,
      yearStart: dateRecord.yearStart as number | null,
      monthStart: dateRecord.monthStart as number | null,
      dayStart: dateRecord.dayStart as number | null,
    },
  }
}

/**
 * Parser strict: menerima array objek atau string JSON berisi array.
 * Payload hilang atau tipe salah LEMPAR Error dengan indeks dan nama
 * field (pola v308), tidak pernah silent-filter.
 */
export function parseCoupleAgeGapPairs(payload: unknown): CoupleAgeGapPair[] {
  let raw: unknown[]
  if (typeof payload === 'string') {
    const parsed: unknown = JSON.parse(payload)
    if (!Array.isArray(parsed)) {
      throw new Error('couple age gap: payload JSON bukan array')
    }
    raw = parsed
  } else {
    if (!Array.isArray(payload)) {
      throw new Error('couple age gap: payload bukan array')
    }
    raw = payload
  }
  return raw.map((item, index) => assertPair(item, index))
}
