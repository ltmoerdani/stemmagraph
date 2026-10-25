/**
 * Next anniversaries (v387, reminder haul): modul PURE untuk daftar
 * pengingat gabungan satu pohon keluarga: ulang tahun anggota hidup dan
 * hari jadi pernikahan pasangan hidup diurutkan jadi satu barisan.
 * Saudara dari src/lib/stats/upcoming-birthdays.ts (v273) dan
 * src/lib/stats/upcoming-anniversaries.ts (v275), dipakai oleh endpoint
 * GET /api/v1/trees/:treeId/reminders/upcoming dan section Reminders
 * pada digest mingguan.
 *
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array input menjadi array terurut.
 *
 * Kontrak: computeNextAnniversaries(items, now, days) menerima array
 * { kind, refId, displayName, date }, kind 'birthday', 'wedding', atau
 * 'haul' (v393: peringatan wafat tahunan anggota yang telah wafat,
 * tanggal efektif haulOverrideDate bila terisi selain deathDate,
 * penyaringan di route/pemanggil),
 * now berupa Date atau komponen { y, m, d } (injeksi waktu untuk
 * determinisme test), dan days sebagai lebar jendela. Output array
 * { kind, refId, displayName, date, nextDate, daysUntil, yearsCompleted }
 * terurut naik daysUntil, tie-break date lebih lama dulu, lalu refId
 * alfabetis.
 *
 * Asumsi pemanggil: penyaringan isAlive (anggota dan kedua pasangan)
 * dan dedup pasangan cermin dilakukan di route/pemanggil. date rusak
 * DILEWATKAN (excluded) di modul ini, parser strict YYYY-MM-DD pola
 * src/lib/stats/living-stats.ts: pola penuh 4-2-2 digit, validasi
 * kalender Gregorian (kabisat benar), tanpa fallback longgar.
 *
 * Semantik tanggal: tanggal tepat hari query = daysUntil 0 dan tetap
 * masuk hasil; nextDate dihitung murni kalender lewat Date.UTC (tanpa
 * getDate lokal, bebas offset zona waktu). Tanggal 29 Feb pada tahun
 * query non-kabisat diperingati pada 1 Mar. Jendela inklusif [0..days];
 * rentang bisnis 1 sampai 365 divalidasi di route.
 *
 * Deterministik: nihil randomness, nihil jam tersembunyi di jalur data
 * (now eksplisit), urutan input tidak mengubah urutan output.
 */

export type NextAnniversaryKind = 'birthday' | 'wedding' | 'haul'

export interface NextAnniversaryInput {
  /** 'birthday' ulang tahun anggota hidup, 'wedding' hari jadi pernikahan pasangan hidup, 'haul' peringatan wafat tahunan anggota wafat (v393). */
  kind: NextAnniversaryKind
  /** personId untuk birthday, pairId untuk wedding (stabil untuk tie-break). */
  refId: string
  /** Nama tampil siap render: satu nama atau 'Nama A & Nama B'. */
  displayName: string
  /** Tanggal sumber YYYY-MM-DD (lahir atau menikah). */
  date: string
}

export interface NextAnniversaryNow {
  y: number
  m: number
  d: number
}

export interface NextAnniversaryEntry {
  kind: NextAnniversaryKind
  refId: string
  displayName: string
  /** Tanggal sumber apa adanya (YYYY-MM-DD), bukan hasil normalisasi. */
  date: string
  /** Tanggal peringatan berikutnya, format YYYY-MM-DD (kalender murni). */
  nextDate: string
  /** Hari menuju peringatan itu; 0 berarti tepat hari query. */
  daysUntil: number
  /** Tahun penuh yang dijangkau pada peringatan itu (umur / tahun menikah / tahun sejak wafat). */
  yearsCompleted: number
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

/**
 * Tanggal peringatan berikutnya untuk satu tanggal sumber: hari jadi di
 * tahun query; bila sudah lewat (atau 29 Feb tanpa 29 Feb di tahun
 * query non-kabisat), geser ke tahun berikutnya dengan penyesuaian
 * 1 Mar untuk 29 Feb.
 */
function nextOccurrence(source: Ymd, ref: Ymd): Ymd {
  let candidate = { y: ref.y, m: source.m, d: source.d }
  if (candidate.m === 2 && candidate.d === 29 && !isLeapYear(candidate.y)) {
    candidate = { y: candidate.y, m: 3, d: 1 }
  }
  if (daysBetween(ref, candidate) < 0) {
    const nextY = ref.y + 1
    candidate = { y: nextY, m: source.m, d: source.d }
    if (candidate.m === 2 && candidate.d === 29 && !isLeapYear(candidate.y)) {
      candidate = { y: nextY, m: 3, d: 1 }
    }
  }
  return candidate
}

export function computeNextAnniversaries(
  items: NextAnniversaryInput[],
  now: Date | NextAnniversaryNow,
  days: number,
): NextAnniversaryEntry[] {
  const ref = now instanceof Date ? utcYmd(now) : now
  const out: NextAnniversaryEntry[] = []

  for (const item of items) {
    const source = parseAnniversaryYmd(item.date)
    if (source === null) continue

    const candidate = nextOccurrence(source, ref)
    const daysUntil = daysBetween(ref, candidate)
    if (daysUntil < 0 || daysUntil > days) continue

    out.push({
      kind: item.kind,
      refId: item.refId,
      displayName: item.displayName,
      date: item.date,
      nextDate: formatYmd(candidate),
      yearsCompleted: candidate.y - source.y,
      daysUntil,
    })
  }

  out.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.refId !== b.refId) return a.refId < b.refId ? -1 : 1
    return 0
  })
  return out
}
