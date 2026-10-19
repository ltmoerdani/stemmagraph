/**
 * Surname marriage matrix (v313 fase i): modul PURE untuk matriks
 * simetris surname x surname dari daftar perkawinan, pilar statistik
 * pohon VISION-stemmagraph. Jangkar: magicsunday/webtrees-statistics
 * getSurnameMarriageMatrix (baris 156, default topN 8) dengan
 * MarriageMatrixRepository::surnameMarriageMatrix. Rujukan pola,
 * bukan salinan kode. Tanpa import server/, tanpa prisma, tanpa
 * fetch: murni transformasi array pasangan surname menjadi angka.
 *
 * Kontrak: computeSurnameMarriageMatrix(pairs, options) menerima
 * daftar pasangan { husbandSurname, wifeSurname } bertipe
 * string | null dan menghasilkan:
 *   nodes: topN surname berdasarkan total keterlibatan (sebagai
 *     husband atau wife), count DESC, tie key ASC alfabetis;
 *   matrix: matriks simetris n x n, matrix[i][j] = jumlah pasangan
 *     antara node i dan node j, diagonal termasuk (surname sama);
 *   pairs: daftar pasangan agregat { a, b, count }, count DESC,
 *     tie key ASC;
 *   skippedMissing: pasangan dengan sisi null, empty, atau
 *     whitespace-only, tidak masuk matriks;
 *   totalPairs: seluruh pasangan valid (kedua sisi terisi).
 *   Array input kosong mengembalikan null (pola v267).
 *
 * Normalisasi: trim spasi di kedua sisi. Kunci dedup lowercase;
 * label node memakai bentuk kemunculan pertama (fold varian ejaan
 * pola v311). Pasangan surname sama (case-insensitive) dihitung di
 * sel diagonal dan matriks tetap simetris [i][j] sama [j][i].
 * pairs hanya memuat pasangan antar node terpilih topN, paralel
 * dengan sel matriks (payload chord diagram).
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data;
 * agregasi berupa penjumlahan sehingga urutan input tidak
 * memengaruhi angka output.
 */

export interface SurnamePair {
  husbandSurname: string | null
  wifeSurname: string | null
}

export interface SurnameMarriagePair {
  a: string
  b: string
  count: number
}

export interface SurnameMarriageMatrixResult {
  nodes: string[]
  matrix: number[][]
  pairs: SurnameMarriagePair[]
  skippedMissing: number
  totalPairs: number
}

export interface SurnameMarriageMatrixOptions {
  /** Jumlah node maksimum yang masuk matriks, default 8 (jangkar). */
  topN?: number
}

/** Default topN mengikuti jangkar getSurnameMarriageMatrix(int $topN = 8). */
const DEFAULT_TOP_N = 8

interface NodeAcc {
  key: string
  label: string
  involvement: number
}

interface PairAcc {
  keyA: string
  keyB: string
  count: number
}

function normalizeSurname(raw: string | null): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function compareNodeDesc(a: NodeAcc, b: NodeAcc): number {
  if (a.involvement !== b.involvement) return b.involvement - a.involvement
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

function comparePairDesc(a: PairAcc, b: PairAcc): number {
  if (a.count !== b.count) return b.count - a.count
  if (a.keyA !== b.keyA) return a.keyA < b.keyA ? -1 : 1
  if (a.keyB !== b.keyB) return a.keyB < b.keyB ? -1 : 1
  return 0
}

export function computeSurnameMarriageMatrix(
  pairs: readonly SurnamePair[],
  options: SurnameMarriageMatrixOptions = {},
): SurnameMarriageMatrixResult | null {
  if (pairs.length === 0) return null

  const topN = options.topN ?? DEFAULT_TOP_N

  const nodeByKey = new Map<string, NodeAcc>()
  const pairAccByKey = new Map<string, PairAcc>()
  let skippedMissing = 0
  let totalPairs = 0

  for (const pair of pairs) {
    const husband = normalizeSurname(pair.husbandSurname)
    const wife = normalizeSurname(pair.wifeSurname)
    if (husband === null || wife === null) {
      skippedMissing += 1
      continue
    }
    totalPairs += 1

    const husbandKey = husband.toLowerCase()
    const wifeKey = wife.toLowerCase()

    let husbandNode = nodeByKey.get(husbandKey)
    if (husbandNode === undefined) {
      husbandNode = { key: husbandKey, label: husband, involvement: 0 }
      nodeByKey.set(husbandKey, husbandNode)
    }
    husbandNode.involvement += 1

    let wifeNode = nodeByKey.get(wifeKey)
    if (wifeNode === undefined) {
      wifeNode = { key: wifeKey, label: wife, involvement: 0 }
      nodeByKey.set(wifeKey, wifeNode)
    }
    wifeNode.involvement += 1

    const keyA = husbandKey <= wifeKey ? husbandKey : wifeKey
    const keyB = husbandKey <= wifeKey ? wifeKey : husbandKey
    const pairKey = `${keyA}\u0000${keyB}`
    let acc = pairAccByKey.get(pairKey)
    if (acc === undefined) {
      acc = { keyA, keyB, count: 0 }
      pairAccByKey.set(pairKey, acc)
    }
    acc.count += 1
  }

  const rankedNodes = Array.from(nodeByKey.values()).sort(compareNodeDesc)
  const selectedNodes = rankedNodes.slice(0, Math.max(topN, 0))
  const indexByKey = new Map<string, number>()
  selectedNodes.forEach((node, index) => indexByKey.set(node.key, index))

  const size = selectedNodes.length
  const matrix: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  )

  const sortedPairs = Array.from(pairAccByKey.values()).sort(comparePairDesc)
  const outputPairs: SurnameMarriagePair[] = []

  for (const acc of sortedPairs) {
    const indexA = indexByKey.get(acc.keyA)
    const indexB = indexByKey.get(acc.keyB)
    if (indexA === undefined || indexB === undefined) continue
    matrix[indexA][indexB] += acc.count
    if (indexA !== indexB) matrix[indexB][indexA] += acc.count
    const labelA = nodeByKey.get(acc.keyA)?.label ?? acc.keyA
    const labelB = nodeByKey.get(acc.keyB)?.label ?? acc.keyB
    outputPairs.push({ a: labelA, b: labelB, count: acc.count })
  }

  return {
    nodes: selectedNodes.map((node) => node.label),
    matrix,
    pairs: outputPairs,
    skippedMissing,
    totalPairs,
  }
}
