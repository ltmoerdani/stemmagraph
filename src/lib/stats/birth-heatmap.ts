/**
 * Birth heatmap periode x bulan (v320 fase i): modul PURE untuk matriks
 * hitungan kelahiran per bucket 25 tahun x kalender bulan 1 sampai 12,
 * pilar 2 VISION-stemmagraph. Jangkar: wt_statistic.php baris 545
 * getBirthHeatmapByPeriodMonth(), delegasi ke LifeSpanRepository::
 * eventHeatmapByPeriodMonth('BIRT'). Tanpa import server/, tanpa
 * prisma, tanpa fetch: murni transformasi array tanggal parsial.
 *
 * DEFINISI: indeks periode = floor(yearStart / 25) * 25 (bucket 25
 * tahun rata ke 0, contoh 1950 masuk periode 1950-1974, tahun 1949
 * masuk periode 1925-1949). Label periode = "<start>-<start+24>".
 *
 * Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v319):
 *   - Parser strict parseBirthHeatmapEntries LEMPAR Error dengan nama
 *     field dan indeks elemen untuk bentuk payload salah (bukan array,
 *     elemen bukan objek, tipe field bukan number/null). DILARANG
 *     silent-filter di level parser.
 *   - Nilai di luar domain adalah data invalid sah: yearStart null,
 *     monthStart null, monthStart di luar [1,12], yearStart <= 0
 *     (guard BCE). Entri demikian di-skip dari matriks dan dihitung
 *     invalidDates, bukan throw.
 *
 * Semantik output: input kosong atau semua invalid tetap mengembalikan
 * { months: [1..12], periods: [], matrix: [], validDates: 0,
 * invalidDates: N } tanpa throw.
 *
 * Deterministik: periods diurut ascending by start sehingga urutan
 * input tidak mengubah bentuk output.
 */

/** Panjang satu bucket periode dalam tahun. */
export const BIRTH_HEATMAP_PERIOD_SPAN = 25

/** Tuple bulan kalender tetap 1 sampai 12, bentuk output stabil. */
export const BIRTH_HEATMAP_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Tanggal parsial ala kolom PartialDate (subset yang relevan). */
export interface BirthDateEntry {
  yearStart: number | null
  monthStart: number | null
}

/** Satu periode 25 tahun berisi data. */
export interface BirthHeatmapPeriod {
  start: number
  label: string
}

/** Payload heatmap: baris matrix sejajar periods, kolom selalu 12. */
export interface BirthHeatmapPayload {
  months: number[]
  periods: BirthHeatmapPeriod[]
  matrix: number[][]
  validDates: number
  invalidDates: number
}

/** Validasi satu entri; lempar Error dengan indeks dan nama field. */
function assertBirthDateEntry(raw: unknown, index: number): BirthDateEntry {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`birth heatmap entry[${index}]: bukan objek`)
  }
  const rec = raw as Record<string, unknown>
  const out: BirthDateEntry = { yearStart: 0, monthStart: 0 }
  for (const field of ['yearStart', 'monthStart'] as const) {
    const value = rec[field]
    if (value === undefined) {
      throw new Error(`birth heatmap entry[${index}].${field}: hilang`)
    }
    if (value !== null && typeof value !== 'number') {
      throw new Error(`birth heatmap entry[${index}].${field}: bukan number atau null`)
    }
    out[field] = value
  }
  return out
}

/**
 * Parser strict payload entri kelahiran. LEMPAR Error pada bentuk
 * salah dengan indeks dan nama field; TANPA silent-filter. Pemilahan
 * invalid dilakukan di lapis komputasi, bukan parser.
 */
export function parseBirthHeatmapEntries(raw: unknown): BirthDateEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('birth heatmap entries: payload bukan array')
  }
  return raw.map((item, index) => assertBirthDateEntry(item, index))
}

/**
 * Hitung matriks heatmap kelahiran per periode 25 tahun x bulan.
 * Entri di luar domain dihitung invalidDates, tidak memicu throw.
 * Hanya periode berisi minimal 1 kelahiran valid yang masuk output,
 * urut ascending by start; baris matrix sejajar periods.
 */
export function computeBirthHeatmap(entries: BirthDateEntry[]): BirthHeatmapPayload {
  const counts = new Map<number, number[]>()
  let validDates = 0
  let invalidDates = 0

  for (const entry of entries) {
    const { yearStart, monthStart } = entry
    const domainValid =
      yearStart !== null &&
      yearStart > 0 &&
      monthStart !== null &&
      monthStart >= 1 &&
      monthStart <= 12
    if (!domainValid) {
      invalidDates += 1
      continue
    }
    validDates += 1
    const periodStart = Math.floor(yearStart / BIRTH_HEATMAP_PERIOD_SPAN) * BIRTH_HEATMAP_PERIOD_SPAN
    let row = counts.get(periodStart)
    if (row === undefined) {
      row = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      counts.set(periodStart, row)
    }
    row[monthStart - 1] += 1
  }

  const starts = Array.from(counts.keys()).sort((a, b) => a - b)
  const periods: BirthHeatmapPeriod[] = starts.map((start) => ({
    start,
    label: `${start}-${start + BIRTH_HEATMAP_PERIOD_SPAN - 1}`,
  }))
  const matrix = starts.map((start) => counts.get(start) as number[])

  return {
    months: [...BIRTH_HEATMAP_MONTHS],
    periods,
    matrix,
    validDates,
    invalidDates,
  }
}
