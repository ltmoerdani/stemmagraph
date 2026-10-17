/**
 * Living family statistics (v267 fase i): modul PURE untuk statistik hidup
 * pilar 2 VISION-stemmagraph. Tanpa import server/, tanpa prisma, tanpa
 * fetch, tanpa jaringan: murni transformasi array member menjadi angka.
 *
 * Kontrak: computeLivingStats(members) sesuai signature wajib; parameter
 * kedua now bersifat opsional (default jam sistem) sehingga pemanggilan
 * satu argumen tetap valid. Injeksi now dipakai test untuk determinisme
 * penuh dan siap dipakai snapshot stats di fase berikutnya.
 *
 * Parsing tanggal lokal: strict YYYY-MM-DD dengan tahun 4 digit dan
 * validasi kalender (bulan 01-12, hari sesuai panjang bulan Gregorian).
 * Util reuse dinilai tidak cocok untuk bentuk ini: parseEventDate
 * (src/lib/gedcom) menerima tahun 1-4 digit dan bentuk GEDCOM lain,
 * parseGenealogicalDate (src/lib/genealogy) mengembalikan phrase untuk
 * teks bebas tanpa komponen tanggal lengkap. Sesuai kontrak, parser
 * lokal kecil dipakai; nihil dependency baru.
 *
 * Semantik output:
 *   total               = jumlah seluruh member.
 *   living / deceased   = partisi berdasarkan isAlive.
 *   unknownBirthDate    = jumlah member (living dan deceased) yang
 *                         birthDate-nya gagal parse. Deceased tanpa
 *                         tanggal lahir otomatis keluar dari rata-rata
 *                         umur karena sampelnya wajib terparse dua arah.
 *   ageBuckets          = hanya LIVING dengan birthDate terparse, umur
 *                         tahun penuh dihitung terhadap now. Tanggal lahir
 *                         di masa depan (umur negatif) tidak masuk bucket
 *                         mana pun dan bukan unknown karena terparse.
 *   avgLifespanYears    = rata-rata umur deceased yang birthDate DAN
 *                         deathDate-nya terparse, dibulatkan 1 desimal;
 *                         null bila tidak ada sampel.
 *   generations         = min dan max dari generation seluruh member;
 *                         array kosong menghasilkan { min: 0, max: 0 }.
 *
 * Deterministik: nihil randomness, nihil jam tersembunyi di jalur data
 * (now eksplisit bila diinjeksi), urutan input tidak mengubah hasil.
 */

export interface LivingStatsMember {
  birthDate: string
  deathDate: string | null
  isAlive: boolean
  generation: number
}

export const AGE_BUCKETS = ['0-17', '18-30', '31-45', '46-60', '61-75', '76+'] as const

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]

export interface LivingStatsResult {
  total: number
  living: number
  deceased: number
  unknownBirthDate: number
  generations: { min: number; max: number }
  avgLifespanYears: number | null
  ageBuckets: Record<AgeBucketKey, number>
}

interface Ymd {
  y: number
  m: number
  d: number
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

function daysInMonth(y: number, m: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m === 2 && isLeapYear(y)) return 29
  return lengths[m - 1]
}

/** Parser lokal strict: YYYY-MM-DD, tahun 4 digit, kalender Gregorian. */
function parseLocalYmd(input: string | null | undefined): Ymd | null {
  if (input === null || input === undefined) return null
  const match = YMD_RE.exec(String(input).trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12) return null
  if (d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/** Komponen kalender dari Date dalam UTC agar bebas offset zona waktu. */
function utcYmd(date: Date): Ymd {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

/** Umur tahun penuh antara dua tanggal kalender (anniversary belum lewat: kurang 1). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

function emptyBuckets(): Record<AgeBucketKey, number> {
  return { '0-17': 0, '18-30': 0, '31-45': 0, '46-60': 0, '61-75': 0, '76+': 0 }
}

function bucketForAge(age: number): AgeBucketKey | null {
  if (age < 0) return null
  if (age <= 17) return '0-17'
  if (age <= 30) return '18-30'
  if (age <= 45) return '31-45'
  if (age <= 60) return '46-60'
  if (age <= 75) return '61-75'
  return '76+'
}

export function computeLivingStats(
  members: LivingStatsMember[],
  now: Date = new Date(),
): LivingStatsResult {
  const ref = utcYmd(now)
  const buckets = emptyBuckets()

  let living = 0
  let deceased = 0
  let unknownBirthDate = 0
  let minGeneration = Number.POSITIVE_INFINITY
  let maxGeneration = Number.NEGATIVE_INFINITY
  let lifespanSum = 0
  let lifespanCount = 0

  for (const member of members) {
    if (member.isAlive) living += 1
    else deceased += 1

    if (member.generation < minGeneration) minGeneration = member.generation
    if (member.generation > maxGeneration) maxGeneration = member.generation

    const birth = parseLocalYmd(member.birthDate)
    if (birth === null) {
      unknownBirthDate += 1
      continue
    }

    if (member.isAlive) {
      const key = bucketForAge(fullYears(birth, ref))
      if (key !== null) buckets[key] += 1
      continue
    }

    const death = parseLocalYmd(member.deathDate)
    if (death === null) continue
    const ageAtDeath = fullYears(birth, death)
    if (ageAtDeath < 0) continue
    lifespanSum += ageAtDeath
    lifespanCount += 1
  }

  const hasMembers = members.length > 0

  return {
    total: members.length,
    living,
    deceased,
    unknownBirthDate,
    generations: {
      min: hasMembers ? minGeneration : 0,
      max: hasMembers ? maxGeneration : 0,
    },
    avgLifespanYears: lifespanCount === 0 ? null : Math.round((lifespanSum / lifespanCount) * 10) / 10,
    ageBuckets: buckets,
  }
}
