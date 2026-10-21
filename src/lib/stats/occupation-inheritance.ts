/**
 * Occupation inheritance (v348 fase i): modul PURE untuk aliran
 * profesi parent ke anak, pilar statistik keluarga VISION-stemmagraph.
 * Jangkar: Statistic.php getOccupationInheritance() baris 1240 sampai
 * 1243, delegasi OccupationInheritanceRepository::occupationInheritance(),
 * payload SankeyFlowsPayload parent ke anak (tab Overview, Sankey
 * parent -> child occupation). Simetris dengan modul top-occupations
 * v333 untuk normalisasi label. Rujukan pola, bukan salinan kode.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa fs: murni
 * transformasi array menjadi angka.
 *
 * Kontrak: computeOccupationInheritance(records) menerima daftar entri
 * SATU PER ANAK { childId, childProfession, fatherProfession,
 * motherProfession }. Satu anak menghasilkan SATU flow untuk SETIAP
 * parent yang profession-nya valid, jadi anak dengan ayah dan ibu
 * berprofesi menyumbang dua flow sekaligus. Anak tanpa profession
 * valid DIBUANG (mengikuti jangkar: flow butuh dua ujung). Anak
 * berprofesi tanpa satu pun parent berprofesi tidak berkontribusi.
 *
 * Normalisasi label pola v333: trim, lowercase, collapse whitespace
 * beruntun jadi satu spasi. Profession null, string kosong, atau
 * whitespace saja = tidak valid. Flow like-to-like (farmer ke
 * farmer) TETAP SAH, konsisten semantik Sankey.
 *
 * Output:
 *   flows: array { from, to, count } dari profession parent ke
 *   profession anak, urut count DESC lalu tie from ASC lalu to ASC;
 *   totalFlows: jumlah count semua flows;
 *   childrenWithFlow: jumlah anak (entri) yang menyumbang minimal
 *   satu flow;
 *   childrenExcluded: jumlah anak (entri) yang dibuang.
 *
 * Parsing strict ber-index pola v333/v344/v346/v347 (prefiks
 * occupation-inheritance): records bukan array, entri bukan objek,
 * childId bukan string, childId string kosong, childProfession/
 * fatherProfession/motherProfession tipe salah (bukan string dan
 * bukan null) DILEMPAR Error ber-index, bukan difilter diam-diam.
 * childId duplikat lintas entri TIDAK didedupe: setiap entri
 * dianggap independen dan tetap dihitung, konsisten v344 v346 v347.
 *
 * Deterministik: akumulasi count per pasangan (from, to) di Map lalu
 * diurut count DESC, from ASC, to ASC, sehingga urutan input tidak
 * memengaruhi isi output. Nihil randomness, nihil jam sistem, nihil
 * I/O di jalur data.
 */

export interface OccupationInheritanceRecord {
  childId: string
  childProfession: string | null
  fatherProfession: string | null
  motherProfession: string | null
}

export interface OccupationInheritanceFlow {
  from: string
  to: string
  count: number
}

export interface OccupationInheritanceResult {
  flows: OccupationInheritanceFlow[]
  totalFlows: number
  childrenWithFlow: number
  childrenExcluded: number
}

const ERROR_PREFIX = 'occupation-inheritance'

/**
 * Normalisasi case-folded pola v333: trim, lowercase, collapse
 * whitespace beruntun jadi satu spasi.
 */
function normalizeProfession(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Profession valid = string yang setelah normalisasi tidak kosong.
 * Kembalikan bentuk ternormalisasi, atau null bila tidak valid.
 */
function normalizeValidProfession(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const normalized = normalizeProfession(raw)
  return normalized === '' ? null : normalized
}

/**
 * Field profession boleh string atau null saja; bentuk lain LEMPAR
 * Error ber-index, tidak pernah silent-filter.
 */
function assertOptionalProfession(
  raw: unknown,
  index: number,
  field: string,
): void {
  if (raw !== null && typeof raw !== 'string') {
    throw new Error(
      `${ERROR_PREFIX}: entri index ${index} ${field} harus string atau null`,
    )
  }
}

/** Tambah satu flow dari from ke to di Map bersarang. */
function addFlow(
  flowCounts: Map<string, Map<string, number>>,
  from: string,
  to: string,
): void {
  let inner = flowCounts.get(from)
  if (inner === undefined) {
    inner = new Map()
    flowCounts.set(from, inner)
  }
  inner.set(to, (inner.get(to) ?? 0) + 1)
}

/**
 * Ratakan Map bersarang jadi array flow lalu urut count DESC,
 * tie from ASC, tie to ASC. Pasangan (from, to) unik sehingga
 * hasil deterministik penuh.
 */
function flattenSortedFlows(
  flowCounts: Map<string, Map<string, number>>,
): OccupationInheritanceFlow[] {
  const flows: OccupationInheritanceFlow[] = []
  flowCounts.forEach((inner, from) => {
    inner.forEach((count, to) => {
      flows.push({ from, to, count })
    })
  })
  return flows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count
    if (a.from !== b.from) return a.from < b.from ? -1 : 1
    if (a.to !== b.to) return a.to < b.to ? -1 : 1
    return 0
  })
}

export function computeOccupationInheritance(
  records: unknown,
): OccupationInheritanceResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input records harus array`)
  }

  const flowCounts = new Map<string, Map<string, number>>()
  let childrenWithFlow = 0
  let childrenExcluded = 0

  records.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} bukan objek`)
    }
    const record = entry as Record<string, unknown>
    if (typeof record.childId !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} childId harus string`,
      )
    }
    if (record.childId.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} childId tidak boleh string kosong`,
      )
    }
    assertOptionalProfession(record.childProfession, index, 'childProfession')
    assertOptionalProfession(record.fatherProfession, index, 'fatherProfession')
    assertOptionalProfession(record.motherProfession, index, 'motherProfession')

    const child = normalizeValidProfession(record.childProfession)
    if (child === null) {
      childrenExcluded += 1
      return
    }
    const father = normalizeValidProfession(record.fatherProfession)
    const mother = normalizeValidProfession(record.motherProfession)
    if (father === null && mother === null) {
      childrenExcluded += 1
      return
    }
    if (father !== null) addFlow(flowCounts, father, child)
    if (mother !== null) addFlow(flowCounts, mother, child)
    childrenWithFlow += 1
  })

  const flows = flattenSortedFlows(flowCounts)
  const totalFlows = flows.reduce((sum, flow) => sum + flow.count, 0)

  return { flows, totalFlows, childrenWithFlow, childrenExcluded }
}
