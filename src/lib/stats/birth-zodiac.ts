/**
 * Births by zodiac (v335 fase i): modul PURE untuk hitungan kelahiran
 * per rasi zodiak Western tropical, pilar 2 VISION-stemmagraph.
 * Jangkar: wt_statistic.php baris 402 getBirthsByZodiacSign(),
 * delegasi ke ZodiacLabels::translateKeys(eventRepository->
 * getBirthsByZodiacSign()). Kunci kanonik English Title Case tetap di
 * modul ini; locale translate adalah urusan view. Tanpa import
 * server/, tanpa prisma, tanpa fetch: murni transformasi array
 * tanggal parsial.
 *
 * Batas rasi (keputusan desain internal kontrak v335, bukan standar
 * lembaga; tidak ada standar genealogi resmi):
 *   Aries 3/21-4/19, Taurus 4/20-5/20, Gemini 5/21-6/20,
 *   Cancer 6/21-7/22, Leo 7/23-8/22, Virgo 8/23-9/22,
 *   Libra 9/23-10/22, Scorpio 10/23-11/21, Sagittarius 11/22-12/21,
 *   Capricorn 12/22-1/19, Aquarius 1/20-2/18, Pisces 2/19-3/20.
 * 29 Februari kabisat jatuh Pisces (rentang 2/19-3/20 menampung).
 * 29 Februari non-kabisat LEMPAR (hari tidak sah). Tahun bebas
 * rentang, tidak ada cutoff.
 *
 * Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v320):
 *   - Parser strict LEMPAR Error dengan nama field dan indeks
 *     elemen: entri bukan objek, birthDate bukan objek, date bukan
 *     string, month bukan integer 1-12, day di luar rentang bulan
 *     (kabisat Gregorian untuk Februari). DILARANG silent-filter di
 *     level parser.
 *   - Tanggal tanpa year month day lengkap adalah data kosong sah:
 *     dihitung excludedEmpty, bukan throw.
 *
 * Semantik output: input kosong tetap mengembalikan { items: [],
 * totalDated: 0, excludedEmpty: 0 } tanpa throw. items hanya berisi
 * rasi ber-count > 0, urut count desc, tie alphabetical asc berdasar
 * label lowercase, sehingga urutan input tidak mengubah output.
 */

/** Satu entri kelahiran: birthDate opsional ala kolom PartialDate. */
export interface BirthZodiacEntry {
  birthDate?: {
    date?: string
    year?: number
    month?: number
    day?: number
  }
}

/** Satu baris hasil: label kanonik English dan hitungannya. */
export interface BirthZodiacItem {
  label: string
  count: number
}

/** Payload akhir: items terfilter, plus rekap counted vs excluded. */
export interface BirthZodiacPayload {
  items: BirthZodiacItem[]
  totalDated: number
  excludedEmpty: number
}

/** Label kanonik 12 rasi, urut abjad untuk bentuk stabil. */
export const ZODIAC_LABELS = [
  'Aquarius',
  'Aries',
  'Cancer',
  'Capricorn',
  'Gemini',
  'Leo',
  'Libra',
  'Pisces',
  'Sagittarius',
  'Scorpio',
  'Taurus',
  'Virgo',
] as const

/** Batas awal rasi sepanjang tahun; 1/1-1/19 tetap Capricorn. */
const ZODIAC_STARTS: Array<{ month: number; day: number; label: string }> = [
  { month: 1, day: 20, label: 'Aquarius' },
  { month: 2, day: 19, label: 'Pisces' },
  { month: 3, day: 21, label: 'Aries' },
  { month: 4, day: 20, label: 'Taurus' },
  { month: 5, day: 21, label: 'Gemini' },
  { month: 6, day: 21, label: 'Cancer' },
  { month: 7, day: 23, label: 'Leo' },
  { month: 8, day: 23, label: 'Virgo' },
  { month: 9, day: 23, label: 'Libra' },
  { month: 10, day: 23, label: 'Scorpio' },
  { month: 11, day: 22, label: 'Sagittarius' },
  { month: 12, day: 22, label: 'Capricorn' },
]

/** Hari maksimum per bulan, Februari non-kabisat. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Kabisat Gregorian: habis 4, kecuali abad yang bukan habis 400. */
function isGregorianLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** Validasi satu entri; lempar Error dengan indeks dan nama field. */
function assertBirthZodiacEntry(raw: unknown, index: number): BirthZodiacEntry {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`birth zodiac entry[${index}]: bukan objek`)
  }
  const rec = raw as Record<string, unknown>
  const birthDate = rec.birthDate
  if (birthDate === undefined || birthDate === null) {
    return {}
  }
  if (typeof birthDate !== 'object' || Array.isArray(birthDate)) {
    throw new Error(`birth zodiac entry[${index}].birthDate: bukan objek`)
  }
  const dateRec = birthDate as Record<string, unknown>
  const date = dateRec.date
  if (date !== undefined && date !== null && typeof date !== 'string') {
    throw new Error(`birth zodiac entry[${index}].birthDate.date: bukan string`)
  }
  return { birthDate: dateRec as BirthZodiacEntry['birthDate'] }
}

/**
 * Ambil (year, month, day) bila lengkap; parsial atau kosong
 * kembalikan null untuk dihitung excludedEmpty. Tipe salah selain
 * undefined/null dianggap payload rusak dan lempar.
 */
function readCompleteDate(
  birthDate: BirthZodiacEntry['birthDate'],
  index: number,
): { year: number; month: number; day: number } | null {
  if (birthDate === undefined || birthDate === null) {
    return null
  }
  const rec = birthDate as Record<string, unknown>
  const fields = ['year', 'month', 'day'] as const
  const values: Record<(typeof fields)[number], number> = { year: 0, month: 0, day: 0 }
  for (const field of fields) {
    const value = rec[field]
    if (value === undefined || value === null) {
      return null
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`birth zodiac entry[${index}].birthDate.${field}: bukan integer`)
    }
    values[field] = value
  }
  if (values.month < 1 || values.month > 12) {
    throw new Error(`birth zodiac entry[${index}].birthDate.month: di luar 1-12`)
  }
  const maxDay =
    values.month === 2 && isGregorianLeap(values.year) ? 29 : DAYS_IN_MONTH[values.month - 1]
  if (values.day < 1 || values.day > maxDay) {
    throw new Error(`birth zodiac entry[${index}].birthDate.day: di luar rentang bulan`)
  }
  return { year: values.year, month: values.month, day: values.day }
}

/** Petakan (month, day) ke label rasi kanonik English Title Case. */
function zodiacLabelFor(month: number, day: number): string {
  let label = 'Capricorn'
  for (const start of ZODIAC_STARTS) {
    if (month > start.month || (month === start.month && day >= start.day)) {
      label = start.label
    }
  }
  return label
}

/**
 * Hitung kelahiran per rasi zodiak dari entri parsial. Parser strict,
 * output deterministik: items hanya count > 0, urut count desc tie
 * alphabetical asc berdasar label lowercase.
 */
export function computeBirthsByZodiac(entries: unknown): BirthZodiacPayload {
  if (!Array.isArray(entries)) {
    throw new Error('birth zodiac: input bukan array')
  }
  const counts = new Map<string, number>()
  let totalDated = 0
  let excludedEmpty = 0
  for (let index = 0; index < entries.length; index += 1) {
    const entry = assertBirthZodiacEntry(entries[index], index)
    const date = readCompleteDate(entry.birthDate, index)
    if (date === null) {
      excludedEmpty += 1
      continue
    }
    const label = zodiacLabelFor(date.month, date.day)
    counts.set(label, (counts.get(label) ?? 0) + 1)
    totalDated += 1
  }
  const items = ZODIAC_LABELS.filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => ({ label, count: counts.get(label) ?? 0 }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase())
    })
  return { items, totalDated, excludedEmpty }
}
