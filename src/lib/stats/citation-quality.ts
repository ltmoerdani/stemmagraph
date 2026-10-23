/**
 * Citation quality (v377 fase i): modul PURE untuk distribusi
 * kualitas sitasi QUAY GEDCOM 7, pilar statistik keluarga
 * VISION-stemmagraph. Jangkar pasar: webtrees Statistics.php dan
 * modul magicsunday/webtrees-statistics hanya punya coverage
 * biner with/without sources, TIDAK ada distribusi tingkat
 * kepercayaan QUAY. GEDCOM 7 (gedcom.io): QUAY {0:1} di bawah
 * SOUR, enum 0 unreliable, 1 questionable, 2 secondary, 3 direct
 * primary. Rujukan pola struktur: citation-coverage (return null
 * input kosong) dan media-by-type (nilai verbatim tanpa
 * normalisasi), bukan salinan kode. Tanpa import server/, tanpa
 * prisma, tanpa fetch, tanpa I/O: murni transformasi array
 * menjadi angka.
 *
 * Kontrak: computeCitationQuality(citations) menerima daftar
 * entri SATU per sitasi event-level, bentuk sejajar ParsedCitation
 * di src/lib/gedcom/citation.ts:
 *   { sourcePointer: string, quay?: string, note?: string }.
 * Input kosong (array 0 entri) menghasilkan null: kosong vs
 * terisi dibedakan, pola citation-coverage.
 *
 * Semantik nilai quay:
 *   - quay undefined: sitasi TANPA sub-struktur QUAY tercatat,
 *     masuk missingQuay (bukan error, bukan invalid).
 *   - quay '0' sampai '3': enum GEDCOM 7 valid, masuk quayValues.
 *     QUAY '0' (unreliable) adalah QUAY TERCATAT: masuk
 *     quayValues, BUKAN missing. Inilah pembeda kosong vs 0.
 *   - quay lainnya (termasuk string kosong): tercatat tapi tak
 *     conforman enum, masuk invalidQuay NILAI VERBATIM tanpa trim
 *     tanpa case folding (dua nilai beda huruf tetap dua bucket
 *     beda, pola media-by-type raw token), distinct diurut
 *     localeCompare asc.
 *
 * note: hanya string non-kosong dihitung withNote; note string
 * kosong dihitung withoutNote (semantik payloadOf citation.ts).
 *
 * Output (input tak kosong), satu objek:
 *   total: panjang input;
 *   quayValues: array { value, count } urut value ASC, hanya
 *     count >= 1;
 *   missingQuay: banyak entri quay undefined;
 *   invalidQuay: array { value, count } distinct urut
 *     localeCompare asc, hanya count >= 1;
 *   notes: { withNote, withoutNote }.
 * Invariant: total = sum quayValues counts + missingQuay + sum
 * invalidQuay counts.
 *
 * i18n: modul menghasilkan KUNCI stabil (value '0' sampai '3',
 * kategori missing, invalid), nihil string bahasa; penerjemahan
 * label dikerjakan view (pola media-by-type raw token).
 *
 * Parsing strict ber-index (prefiks citation-quality, pola modul
 * stats lain): citations bukan array, entri bukan objek,
 * sourcePointer bukan string atau string kosong, quay ada tapi
 * bukan string dan bukan undefined, note ada tapi bukan string
 * dan bukan undefined DILEMPAR Error ber-index, bukan difilter
 * diam-diam. quay string kosong TIDAK throw: masuk invalidQuay.
 *
 * Deterministik: akumulasi count di Map lalu diurut, sehingga
 * urutan input tidak memengaruhi isi output. Nihil randomness,
 * nihil jam sistem, nihil I/O di jalur data.
 */

export interface CitationQualityEntry {
  sourcePointer: string
  quay?: string
  note?: string
}

export interface CitationQualityCount {
  value: string
  count: number
}

export interface CitationQualityResult {
  total: number
  quayValues: CitationQualityCount[]
  missingQuay: number
  invalidQuay: CitationQualityCount[]
  notes: { withNote: number, withoutNote: number }
}

const VALID_QUAY = new Set(['0', '1', '2', '3'])

export function computeCitationQuality(
  citations: CitationQualityEntry[]
): CitationQualityResult | null {
  if (!Array.isArray(citations)) {
    throw new Error('citation-quality[0]: citations harus array')
  }

  if (citations.length === 0) {
    return null
  }

  const quayCounts = new Map<string, number>()
  const invalidCounts = new Map<string, number>()
  let missingQuay = 0
  let withNote = 0

  citations.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`citation-quality[${index}]: entri harus objek`) 
    }
    if (typeof entry.sourcePointer !== 'string' || entry.sourcePointer === '') {
      throw new Error(`citation-quality[${index}]: sourcePointer harus string tidak kosong`)
    }
    if (entry.quay !== undefined && typeof entry.quay !== 'string') {
      throw new Error(`citation-quality[${index}]: quay harus string atau undefined`)
    }
    if (entry.note !== undefined && typeof entry.note !== 'string') {
      throw new Error(`citation-quality[${index}]: note harus string atau undefined`)
    }

    if (entry.quay === undefined) {
      missingQuay += 1
    } else if (VALID_QUAY.has(entry.quay)) {
      quayCounts.set(entry.quay, (quayCounts.get(entry.quay) ?? 0) + 1)
    } else {
      invalidCounts.set(entry.quay, (invalidCounts.get(entry.quay) ?? 0) + 1)
    }

    if (entry.note !== undefined && entry.note !== '') {
      withNote += 1
    }
  })

  const quayValues = [...quayCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))
  const invalidQuay = [...invalidCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))

  return {
    total: citations.length,
    quayValues,
    missingQuay,
    invalidQuay,
    notes: { withNote, withoutNote: citations.length - withNote },
  }
}
