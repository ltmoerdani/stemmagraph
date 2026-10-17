/**
 * Upcoming wedding anniversaries (v275 fase i, endpoint read-only): modul
 * PURE untuk daftar hari jadi pernikahan yang akan datang, saudara modul
 * upcoming-birthdays.ts (v273). Tanpa import server/, tanpa prisma, tanpa
 * fetch, tanpa jaringan: murni transformasi array input menjadi terurut.
 *
 * Kontrak: computeUpcomingAnniversaries(pairs, now, days) menerima array
 * pasangan { pairId, partnerNames, marriageDate }, now berupa Date atau
 * komponen { y, m, d } (injeksi waktu untuk determinisme test), dan days
 * sebagai lebar jendela. Output array
 * { pairId, partnerNames, marriageDate, nextAnniversary, daysUntil,
 * yearsMarried } terurut naik daysUntil, tie-break marriageDate lebih
 * lama dulu, lalu pairId alfabetis.
 *
 * Asumsi pemanggil: hanya pasangan LIVING yang dikirim; dedup pasangan
 * cermin dan penyaringan isAlive dilakukan di route. marriageDate rusak
 * DILEWATKAN (excluded) di modul ini, parser strict YYYY-MM-DD pola
 * src/lib/stats/living-stats.ts: pola penuh 4-2-2 digit, validasi
 * kalender Gregorian (kabisat benar), tanpa fallback longgar.
 *
 * Semantik tanggal: hari jadi tepat hari query = daysUntil 0 dan tetap
 * masuk hasil; nextAnniversary dihitung murni kalender lewat Date.UTC
 * (tanpa getDate lokal, bebas offset zona waktu). Pernikahan 29 Feb pada
 * tahun query non-kabisat diperingati pada 1 Mar. Jendela inklusif
 * [0..days]; rentang bisnis 1 sampai 365 divalidasi di route.
 *
 * Deterministik: nihil randomness, nihil jam tersembunyi di jalur data
 * (now eksplisit), urutan input tidak mengubah urutan output.
 */

export interface UpcomingAnniversaryInput {
  pairId: string
  partnerNames: [string, string]
  marriageDate: string
}

export interface UpcomingAnniversaryNow {
  y: number
  m: number
  d: number
}

export interface UpcomingAnniversaryEntry {
  pairId: string
  partnerNames: [string, string]
  marriageDate: string
  /** Tanggal hari jadi berikutnya, format YYYY-MM-DD (kalender murni). */
  nextAnniversary: string
  /** Hari menuju hari jadi berikutnya; 0 berarti tepat hari query. */
  daysUntil: number
  /** Tahun pernikahan penuh yang dijangkau pada hari jadi itu. */
  yearsMarried: number
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
export function parseAnniversaryYmd(input: string | null | undefined): Ymd | null {
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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatYmd(v: Ymd): string {
  return `${String(v.y).padStart(4, '0')}-${pad2(v.m)}-${pad2(v.d)}`
}

/** Komponen kalender dari Date dalam UTC agar bebas offset zona waktu. */
function utcYmd(date: Date): Ymd {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

/** Selisih hari penuh antara dua tanggal kalender via Date.UTC murni. */
function daysBetween(a: Ymd, b: Ymd): number {
  const msA = Date.UTC(a.y, a.m - 1, a.d)
  const msB = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((msB - msA) / 86_400_000)
}

export function computeUpcomingAnniversaries(
  pairs: UpcomingAnniversaryInput[],
  now: Date | UpcomingAnniversaryNow,
  days: number,
): UpcomingAnniversaryEntry[] {
  const ref = now instanceof Date ? utcYmd(now) : now
  const out: UpcomingAnniversaryEntry[] = []

  for (const pair of pairs) {
    const marriage = parseAnniversaryYmd(pair.marriageDate)
    if (marriage === null) continue

    // Hari jadi pernikahan berikutnya: anniversary di tahun query; bila
    // sudah lewat (atau 29 Feb tanpa 29 Feb di tahun query non-kabisat),
    // geser ke tahun berikutnya dengan penyesuaian 1 Mar untuk 29 Feb.
    let candidate = { y: ref.y, m: marriage.m, d: marriage.d }
    if (candidate.m === 2 && candidate.d === 29 && !isLeapYear(candidate.y)) {
      candidate = { y: candidate.y, m: 3, d: 1 }
    }
    if (daysBetween(ref, candidate) < 0) {
      const nextY = ref.y + 1
      candidate = { y: nextY, m: marriage.m, d: marriage.d }
      if (candidate.m === 2 && candidate.d === 29 && !isLeapYear(candidate.y)) {
        candidate = { y: nextY, m: 3, d: 1 }
      }
    }

    const daysUntil = daysBetween(ref, candidate)
    if (daysUntil < 0 || daysUntil > days) continue

    out.push({
      pairId: pair.pairId,
      partnerNames: pair.partnerNames,
      marriageDate: pair.marriageDate,
      nextAnniversary: formatYmd(candidate),
      yearsMarried: candidate.y - marriage.y,
      daysUntil,
    })
  }

  out.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
    if (a.marriageDate !== b.marriageDate) return a.marriageDate < b.marriageDate ? -1 : 1
    if (a.pairId !== b.pairId) return a.pairId < b.pairId ? -1 : 1
    return 0
  })
  return out
}
