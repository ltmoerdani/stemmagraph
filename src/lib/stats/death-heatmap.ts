/**
 * Death heatmap periode x bulan (v321 fase i): modul PURE untuk matriks
 * hitungan kematian per bucket 25 tahun x kalender bulan 1 sampai 12,
 * pilar 2 VISION-stemmagraph. Jangkar: wt_statistic.php baris 555
 * getDeathHeatmapByPeriodMonth(), delegasi ke LifeSpanRepository::
 * eventHeatmapByPeriodMonth('DEAT'). Simetris birth-heatmap.ts (v320,
 * merged 54dd711). Tanpa import server/, tanpa prisma, tanpa fetch:
 * murni transformasi array tanggal parsial.
 *
 * DEFINISI: indeks periode = floor(yearStart / 25) * 25 (bucket 25
 * tahun rata ke 0, contoh 1950 masuk periode 1950-1974, tahun 1949
 * masuk periode 1925-1949). Label periode = "<start>-<start+24>".
 *
 * Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v319/v320):
 *   - Parser strict parseDeathHeatmapEntries LEMPAR Error dengan nama
 *     field dan indeks elemen untuk bentuk payload salah (bukan array,
 *     elemen bukan objek, tipe field bukan number/null). DILARANG
 *     silent-filter di level parser.
 *   - Nilai di luar domain adalah data invalid sah: yearStart null,
 *     monthStart null, monthStart di luar [1,12], yearStart <= 0
 *     (guard BCE). Entri demikian di-skip dari matriks dan dihitung
 *     invalidDeaths, bukan throw.
 *
 * Semantik output: input kosong atau semua invalid tetap mengembalikan
 * { months: [1..12], periods: [], matrix: [], validDeaths: 0,
 * invalidDeaths: N } tanpa throw.
 *
 * Deterministik: periods diurut ascending by start sehingga urutan
 * input tidak mengubah bentuk output.
 */

/** Panjang satu bucket periode dalam tahun. */
export const DEATH_HEATMAP_PERIOD_SPAN = 25

/** Tuple bulan kalender tetap 1 sampai 12, bentuk output stabil. */
export const DEATH_HEATMAP_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Tanggal parsial ala kolom PartialDate (subset yang relevan). */
export interface DeathDateEntry {
  yearStart: number | null
  monthStart: number | null
}

/** Satu periode 25 tahun berisi data. */
export interface DeathHeatmapPeriod {
  start: number
  label: string
}

/** Payload heatmap: baris matrix sejajar periods, kolom selalu 12. */
export interface DeathHeatmapPayload {
  months: number[]
  periods: DeathHeatmapPeriod[]
  matrix: number[][]
  validDeaths: number
  invalidDeaths: number
}

/** Validasi satu entri; lempar Error dengan indeks dan nama field. */
function assertDeathDateEntry(raw: unknown, index: number): DeathDateEntry {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`death heatmap entry[${index}]: bukan objek`)
  }
  const rec = raw as Record<string, unknown>
  const out: DeathDateEntry = { yearStart: 0, monthStart: 0 }
  for (const field of ['yearStart', 'monthStart'] as const) {
    const value = rec[field]
    if (value === undefined) {
      throw new Error(`death heatmap entry[${index}].${field}: hilang`)
    }
    if (value !== null && typeof value !== 'number') {
      throw new Error(`death heatmap entry[${index}].${field}: bukan number atau null`)
    }
    out[field] = value
  }
  return out
}

/**
 * Parser strict payload entri kematian. LEMPAR Error pada bentuk
 * salah dengan indeks dan nama field; TANPA silent-filter. Pemilahan
 * invalid dilakukan di lapis komputasi, bukan parser.
 */
export function parseDeathHeatmapEntries(raw: unknown): DeathDateEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('death heatmap entries: payload bukan array')
  }
  return raw.map((item, index) => assertDeathDateEntry(item, index))
}

/**
 * Hitung matriks heatmap kematian per periode 25 tahun x bulan.
 * Entri di luar domain dihitung invalidDeaths, tidak memicu throw.
 * Hanya periode berisi minimal 1 kematian valid yang masuk output,
 * urut ascending by start; baris matrix sejajar periods.
 */
export function computeDeathHeatmap(entries: DeathDateEntry[]): DeathHeatmapPayload {
  const counts = new Map<number, number[]>()
  let validDeaths = 0
  let invalidDeaths = 0

  for (const entry of entries) {
    const { yearStart, monthStart } = entry
    const domainValid =
      yearStart !== null &&
      yearStart > 0 &&
      monthStart !== null &&
      monthStart >= 1 &&
      monthStart <= 12
    if (!domainValid) {
      invalidDeaths += 1
      continue
    }
    validDeaths += 1
    const periodStart = Math.floor(yearStart / DEATH_HEATMAP_PERIOD_SPAN) * DEATH_HEATMAP_PERIOD_SPAN
    let row = counts.get(periodStart)
    if (row === undefined) {
      row = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      counts.set(periodStart, row)
    }
    row[monthStart - 1] += 1
  }

  const starts = Array.from(counts.keys()).sort((a, b) => a - b)
  const periods: DeathHeatmapPeriod[] = starts.map((start) => ({
    start,
    label: `${start}-${start + DEATH_HEATMAP_PERIOD_SPAN - 1}`,
  }))
  const matrix = starts.map((start) => counts.get(start) as number[])

  return {
    months: [...DEATH_HEATMAP_MONTHS],
    periods,
    matrix,
    validDeaths,
    invalidDeaths,
  }
}
