/**
 * Religions top-N (v343 fase i): modul PURE untuk frekuensi
 * agama (1 RELI facts per individu) lintas pohon.
 * Jangkar: wt_statistic.php baris 1186 getTopReligions(int $limit)
 * delegasi religionRepository->top($limit), case-folded sehingga
 * varian ejaan merge satu bucket.
 *
 * DEFINISI: input array item { religion: string }, satu entri per
 * individu ber-RELI. Normalisasi case-folded pola kontrak v343:
 * trim lalu toLowerCase. String kosong setelah trim masuk seri
 * 'unknown' terpisah: tidak masuk ranking items, tidak masuk
 * totalDated maupun distinctCount.
 *
 * Output deterministik: items urut count desc, tie-break
 * alphabetical asc locale-independent, dipotong limit, label
 * lowercase. limit default 8 mirror jangkar topN 8.
 *
 * Parser strict (pola top-occupations v333): entries bukan array,
 * entri bukan objek, atau religion bukan string LEMPAR Error
 * ber-index dengan prefiks top-religions. limit wajib integer
 * >= 1 selain itu LEMPAR Error prefiks sama.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Hasil lengkap top-N agama. */
export interface TopReligionsResult {
  items: Array<{ label: string; count: number }>
  totalDated: number
  distinctCount: number
  limit: number
}

/** Validasi limit: integer >= 1 selain itu lempar Error. */
function assertLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new Error('top-religions: limit wajib integer >= 1')
  }
}

/** Validasi satu entri religion ber-index; bentuk salah LEMPAR Error. */
function assertEntry(raw: unknown, index: number): string {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`top-religions: entries[${index}] bukan objek`)
  }
  const entry = raw as Record<string, unknown>
  if (typeof entry.religion !== 'string') {
    throw new Error(`top-religions: entries[${index}].religion hilang atau bukan string`)
  }
  return entry.religion
}

/**
 * Parser strict: menerima array objek { religion: string }.
 * Payload salah LEMPAR Error ber-index dengan prefiks
 * top-religions, tidak pernah silent-filter.
 */
export function parseReligions(entries: unknown): string[] {
  if (!Array.isArray(entries)) {
    throw new Error('top-religions: entries bukan array')
  }
  return entries.map((entry, index) => assertEntry(entry, index))
}

/** Normalisasi case-folded kontrak v343: trim lalu lowercase. */
function normalizeReligion(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Top-N agama: agregasi frekuensi case-folded, urutan count desc
 * tie-break alphabetical asc, potong limit. Entri kosong setelah
 * trim dikecualikan dari ranking dan seluruh angka ringkasan.
 */
export function computeTopReligions(
  entries: unknown,
  options?: { limit?: number },
): TopReligionsResult {
  const limit = options?.limit ?? 8
  assertLimit(limit)
  const religions = parseReligions(entries)

  const counts = new Map<string, number>()
  let totalDated = 0
  for (const raw of religions) {
    const religion = normalizeReligion(raw)
    if (religion === '') continue
    counts.set(religion, (counts.get(religion) ?? 0) + 1)
    totalDated += 1
  }

  const items = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      if (a.label < b.label) return -1
      if (a.label > b.label) return 1
      return 0
    })
    .slice(0, limit)

  return { items, totalDated, distinctCount: counts.size, limit }
}
