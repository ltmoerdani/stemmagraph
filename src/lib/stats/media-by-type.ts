/**
 * Media by type (v360 fase i): modul PURE untuk distribusi tipe
 * media GEDCOM, pilar statistik keluarga VISION-stemmagraph.
 * Jangkar: wt_statistic.php baris 626 getMediaByType(), objek
 * media dikelompokkan per recorded source-media type, most
 * frequent first, keyed by raw GEDCOM type token; penerjemahan
 * token ke label dikerjakan view. Rujukan pola struktur:
 * divorces-by-century v347 (null masuk penghitung undated), bukan
 * salinan kode. Tanpa import server/, tanpa prisma, tanpa fetch,
 * tanpa I/O: murni transformasi array menjadi angka.
 *
 * Kontrak: computeMediaByType(media) menerima daftar entri SATU
 * per objek media { mediaId: string; typeToken: string | null }.
 * typeToken null berarti media tanpa tipe tercatat: SAH, masuk
 * penghitung undatedCount, bukan error. Token dipertahankan RAW
 * sesuai jangkar keyed by raw token: TANPA case folding (IMAGE
 * dan image adalah dua bucket beda), TANPA trim, TANPA
 * normalisasi lain. Output:
 *   tokens: array { token, count } urut count desc, tie-break
 *   token localeCompare asc (deterministik, pola v349 sampai
 *   v359); hanya token dengan count >= 1 yang muncul;
 *   undatedCount: banyak entri typeToken null;
 *   total: panjang input, sama dengan sum counts + undatedCount.
 *
 * mediaId duplikat lintas entri SAH dan tetap dihitung per
 * entri: modul menghitung objek media, bukan id unik.
 *
 * Parsing strict ber-index (prefiks media-by-type, pola v349
 * sampai v359): media bukan array, entri bukan objek, mediaId
 * bukan string atau string kosong, typeToken bukan string dan
 * bukan null, atau token string kosong DILEMPAR Error
 * ber-index, bukan difilter diam-diam.
 *
 * Deterministik: akumulasi count per token di Map lalu diurut
 * count desc dengan tie-break localeCompare asc, sehingga
 * urutan input tidak memengaruhi isi output. Nihil randomness,
 * nihil jam sistem, nihil I/O di jalur data.
 */

export interface MediaEntry {
  mediaId: string
  typeToken: string | null
}

export interface MediaByTypeResult {
  tokens: { token: string, count: number }[]
  undatedCount: number
  total: number
}

const ERROR_PREFIX = 'media-by-type'

export function computeMediaByType(media: unknown): MediaByTypeResult {
  if (!Array.isArray(media)) {
    throw new Error(`${ERROR_PREFIX}: input media harus array`)
  }

  const counts = new Map<string, number>()
  let undatedCount = 0

  media.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} bukan objek`)
    }
    const item = entry as Record<string, unknown>
    if (typeof item.mediaId !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} mediaId harus string`,
      )
    }
    if (item.mediaId.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} mediaId tidak boleh string kosong`,
      )
    }
    if (item.typeToken === null) {
      undatedCount += 1
      return
    }
    if (typeof item.typeToken !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} typeToken harus string atau null`,
      )
    }
    if (item.typeToken.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} typeToken tidak boleh string kosong`,
      )
    }
    counts.set(item.typeToken, (counts.get(item.typeToken) ?? 0) + 1)
  })

  const tokens = [...counts.keys()]
    .map((token) => ({ token, count: counts.get(token) as number }))
    .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token))

  const total = media.length

  return { tokens, undatedCount, total }
}
