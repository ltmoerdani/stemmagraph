/**
 * Average marriage age (v280 fase i): modul PURE untuk usia pernikahan
 * rata-rata, pilar 2 VISION-stemmagraph. Saudara modul dependency-ratio.ts
 * (v278). Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array pasangan menjadi statistik atau null.
 *
 * DEFINISI: usia pernikahan = tahun penuh (completed years, floor) antara
 * tanggal lahir dan tanggal MARR, pola fullYears living-stats.ts v267
 * (anniversary belum lewat: kurang 1). Rata-rata dihitung dari jumlah usia
 * dibagi banyak pasangan valid.
 *
 * Presisi: rata-rata presisi penuh tersedia di averageExact
 * (computeMarriageAgeStats); output utama computeAverageMarriageAge
 * dibulatkan 1 desimal via Math.round(x * 10) / 10 (pola v267 v268).
 *
 * Penyaringan PER PASANGAN (bukan per pohon):
 *   - Tanggal lahir salah satu pihak hilang (null) atau bukan EXACT
 *     lengkap (y, m, d): pasangan di-skip. PartialDate dengan dateKind
 *     selain EXACT (ABOUT/ABT, RANGE/BET, BEFORE/BEF, AFTER/AFT, EST)
 *     mengecualikan pasangan itu, pasangan lain tetap ikut hitung.
 *   - Tanggal MARR hilang atau bukan EXACT lengkap: pasangan di-skip.
 *   - Usia negatif (lahir setelah menikah): pasangan di-skip.
 *
 * Semantik output: pohon kosong atau nihil pasangan valid mengembalikan
 * null (null-guard pola v267), bukan angka 0. Hasil tak pernah negatif
 * karena usia negatif sudah disaring.
 *
 * Deterministik: usia diproses terurut pairId ascending sehingga urutan
 * input tidak mengubah hasil, termasuk pada tingkat float.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface MarriageAgeDate {
  /** "EXACT" untuk tanggal pasti; kind lain (ABOUT, RANGE, EST, dll)
   *  mengecualikan pasangan pemilik tanggal itu. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface MarriageAgeSpouse {
  id: string
  birthDate: MarriageAgeDate | null
}

export interface MarriageAgePair {
  pairId: string
  spouseA: MarriageAgeSpouse
  spouseB: MarriageAgeSpouse
  marriageDate: MarriageAgeDate | null
}

export interface MarriageAgeStats {
  /** Banyak pasangan valid yang masuk perhitungan. */
  count: number
  /** Rata-rata usia pernikahan tanpa pembulatan; null bila nihil valid. */
  averageExact: number | null
  /** Rata-rata dibulatkan 1 desimal; null bila nihil valid. */
  averageRounded: number | null
}

interface Ymd {
  y: number
  m: number
  d: number
}

/** Tanggal EXACT dengan komponen kalender lengkap dan dalam rentang masuk akal. */
function exactYmd(date: MarriageAgeDate | null): Ymd | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  if (monthStart < 1 || monthStart > 12) return null
  if (dayStart < 1 || dayStart > 31) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

/** Umur tahun penuh antara dua tanggal kalender (pola v267 living-stats). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

/** Kumpulan pasangan valid: terurut pairId ascending agar deterministik. */
function validMarriageAges(pairs: MarriageAgePair[]): { pairId: string; age: number }[] {
  const valid: { pairId: string; age: number }[] = []
  for (const pair of pairs) {
    const birthA = exactYmd(pair.spouseA.birthDate)
    const birthB = exactYmd(pair.spouseB.birthDate)
    const marriage = exactYmd(pair.marriageDate)
    if (birthA === null || birthB === null || marriage === null) continue
    const age = fullYears(birthA, marriage)
    if (age < 0) continue
    valid.push({ pairId: pair.pairId, age })
  }
  valid.sort((a, b) => (a.pairId < b.pairId ? -1 : a.pairId > b.pairId ? 1 : 0))
  return valid
}

/** Statistik lengkap: count, rata-rata presisi penuh, rata-rata 1 desimal. */
export function computeMarriageAgeStats(pairs: MarriageAgePair[]): MarriageAgeStats {
  const valid = validMarriageAges(pairs)
  if (valid.length === 0) {
    return { count: 0, averageExact: null, averageRounded: null }
  }
  let sum = 0
  for (const v of valid) sum += v.age
  const exact = sum / valid.length
  return {
    count: valid.length,
    averageExact: exact,
    averageRounded: Math.round(exact * 10) / 10,
  }
}

/** Usia pernikahan rata-rata dibulatkan 1 desimal; null bila nihil valid. */
export function computeAverageMarriageAge(pairs: MarriageAgePair[]): number | null {
  return computeMarriageAgeStats(pairs).averageRounded
}
