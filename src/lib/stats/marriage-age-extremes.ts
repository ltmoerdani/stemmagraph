/**
 * Marriage age extremes (v362 fase i): modul PURE untuk pencarian
 * pasangan termuda dan tertua saat menikah per sex. Jangkar:
 * magicsunday/webtrees-statistics wt_statistic.php baris 754
 * getTreeRecords(), slot youngestSpouseAtMarriageRecord('M'),
 * youngestSpouseAtMarriageRecord('F'), oldestSpouseAtMarriageRecord('M'),
 * oldestSpouseAtMarriageRecord('F') dari MarriageRepository.
 *
 * DEFINISI: usia pernikahan = tahun penuh (completed years, floor) antara
 * tanggal lahir dan tanggal MARR, pola fullYears living-stats.ts v267
 * (anniversary belum lewat: kurang 1). Saudara modul marriage-age.ts
 * (v280) dan marriage-duration.ts (v331).
 *
 * Penyaringan PER SPOUSE (bukan per pasangan):
 *   - Tanggal lahir spouse hilang (null) atau bukan EXACT lengkap
 *     (y, m, d; bulan 1-12, hari 1-31): spouse di-skip.
 *   - Tanggal MARR pasangan hilang atau bukan EXACT lengkap: kedua
 *     spouse pasangan itu di-skip.
 *   - Usia negatif (lahir setelah menikah): spouse di-skip.
 *   - Spouse yang gagal validasi tidak menggugurkan pasangannya;
 *     spouse lain di pasangan yang sama tetap dinilai independen.
 *   - Sex selain 'M' atau 'F' tidak masuk kuadran manapun.
 *
 * Semantik per record: satu orang dengan banyak pernikahan menjadi
 * kandidat terpisah di tiap pernikahannya dan boleh menang di lebih
 * dari satu entry. Tie-break deterministik: age optimal menang, lalu
 * pairId ascending, lalu xref ascending. Input diproses terurut
 * pairId ascending sehingga urutan input tidak mengubah hasil.
 *
 * Output empat kuadran youngest/oldest untuk M dan F. Kuadran tanpa
 * kandidat valid = null (null-guard pola v267/v280). validSpouseCount
 * per sex menghitung spouse M dan F yang lolos seluruh validasi.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random, em dash 0.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface MarriageAgeExtremesDate {
  /** "EXACT" untuk tanggal pasti; kind lain (ABOUT, RANGE, EST, dll)
   *  mengecualikan pemilik tanggal itu dari kandidat. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface MarriageAgeExtremesSpouse {
  id: string
  sex: string
  birthDate: MarriageAgeExtremesDate | null
}

export interface MarriageAgeExtremesPair {
  pairId: string
  spouseA: MarriageAgeExtremesSpouse
  spouseB: MarriageAgeExtremesSpouse
  marriageDate: MarriageAgeExtremesDate | null
}

/** Satu entry kuadran: orang (xref) pada pernikahan tertentu. */
export interface MarriageAgeExtremeEntry {
  xref: string
  pairId: string
  age: number
}

export interface MarriageAgeExtremesResult {
  /** Pernikahan termuda sex M; null bila nihil kandidat valid. */
  youngestMale: MarriageAgeExtremeEntry | null
  /** Pernikahan tertua sex M; null bila nihil kandidat valid. */
  oldestMale: MarriageAgeExtremeEntry | null
  /** Pernikahan termuda sex F; null bila nihil kandidat valid. */
  youngestFemale: MarriageAgeExtremeEntry | null
  /** Pernikahan tertua sex F; null bila nihil kandidat valid. */
  oldestFemale: MarriageAgeExtremeEntry | null
  /** Banyak spouse M dan F yang lolos seluruh validasi. */
  validSpouseCount: { male: number; female: number }
}

interface Ymd {
  y: number
  m: number
  d: number
}

interface Candidate extends MarriageAgeExtremeEntry {
  sex: 'M' | 'F'
}

/** Tanggal EXACT dengan komponen kalender lengkap dan dalam rentang masuk akal. */
function exactYmd(date: MarriageAgeExtremesDate | null): Ymd | null {
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

/** Kandidat lebih muda usianya; seri: pairId lalu xref ascending. */
function betterYoungest(a: Candidate, b: Candidate): Candidate {
  if (a.age !== b.age) return a.age < b.age ? a : b
  if (a.pairId !== b.pairId) return a.pairId < b.pairId ? a : b
  return a.xref <= b.xref ? a : b
}

/** Kandidat lebih tua usianya; seri: pairId lalu xref ascending. */
function betterOldest(a: Candidate, b: Candidate): Candidate {
  if (a.age !== b.age) return a.age > b.age ? a : b
  if (a.pairId !== b.pairId) return a.pairId < b.pairId ? a : b
  return a.xref <= b.xref ? a : b
}

/** Kumpulan kandidat valid, input diproses terurut pairId ascending. */
function collectCandidates(pairs: MarriageAgeExtremesPair[]): {
  candidates: Candidate[]
  counts: { male: number; female: number }
} {
  const sorted = [...pairs].sort((a, b) =>
    a.pairId < b.pairId ? -1 : a.pairId > b.pairId ? 1 : 0,
  )
  const candidates: Candidate[] = []
  const counts = { male: 0, female: 0 }

  for (const pair of sorted) {
    const marriage = exactYmd(pair.marriageDate)
    if (marriage === null) continue
    for (const spouse of [pair.spouseA, pair.spouseB]) {
      const birth = exactYmd(spouse.birthDate)
      if (birth === null) continue
      const age = fullYears(birth, marriage)
      if (age < 0) continue
      if (spouse.sex !== 'M' && spouse.sex !== 'F') continue
      if (spouse.sex === 'M') counts.male += 1
      else counts.female += 1
      candidates.push({ xref: spouse.id, pairId: pair.pairId, age, sex: spouse.sex })
    }
  }
  return { candidates, counts }
}

function toEntry(c: Candidate): MarriageAgeExtremeEntry {
  return { xref: c.xref, pairId: c.pairId, age: c.age }
}

/** Empat kuadran usia pernikahan ekstrem per sex plus count spouse valid. */
export function computeMarriageAgeExtremes(
  pairs: MarriageAgeExtremesPair[],
): MarriageAgeExtremesResult {
  const { candidates, counts } = collectCandidates(pairs)

  let youngestM: Candidate | null = null
  let oldestM: Candidate | null = null
  let youngestF: Candidate | null = null
  let oldestF: Candidate | null = null

  for (const c of candidates) {
    if (c.sex === 'M') {
      youngestM = youngestM === null ? c : betterYoungest(youngestM, c)
      oldestM = oldestM === null ? c : betterOldest(oldestM, c)
    } else {
      youngestF = youngestF === null ? c : betterYoungest(youngestF, c)
      oldestF = oldestF === null ? c : betterOldest(oldestF, c)
    }
  }

  return {
    youngestMale: youngestM === null ? null : toEntry(youngestM),
    oldestMale: oldestM === null ? null : toEntry(oldestM),
    youngestFemale: youngestF === null ? null : toEntry(youngestF),
    oldestFemale: oldestF === null ? null : toEntry(oldestF),
    validSpouseCount: counts,
  }
}
