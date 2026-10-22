/**
 * Record inventory (v361 fase i): modul PURE untuk inventaris
 * tipe rekaman Tree-health tab, pilar statistik keluarga
 * VISION-stemmagraph. Jangkar: wt_statistic.php baris 614
 * getRecordInventory(): menghitung rekaman inti person/family
 * versus tiap tipe enrichment (sources, media, shared notes,
 * repositories, shared locations), plus enrichment density per
 * 100 individu, sinyal pohon telanjang versus pohon ter-sumber
 * baik. Rujukan pola struktur: media-by-type.ts v360 (parsing
 * strict ber-prefiks, union type kind), bukan salinan kode.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa I/O:
 * murni transformasi array menjadi angka.
 *
 * Kontrak: computeRecordInventory(entries) menerima daftar
 * entri { recordId: string; kind: RecordKind } dengan
 * RecordKind = person | family | source | media | note |
 * repository | location (7 nilai enum). Output urutan field
 * tetap:
 *   persons, families, core, sources, media, notes,
 *   repositories, locations, enrichment, total, densityPer100
 * dengan core = persons + families; enrichment = sources +
 * media + notes + repositories + locations; total = panjang
 * input (sama dengan core + enrichment).
 *
 * densityPer100 = enrichment / persons * 100 dibulatkan 1
 * desimal via Math.round(enrichment * 1000 / persons) / 10.
 * persons = 0 menghasilkan densityPer100 null: rasio tak
 * terdefinisi tanpa individu, baik saat input kosong maupun
 * saat hanya ada rekaman enrichment.
 *
 * recordId duplikat lintas entri SAH dan tetap dihitung per
 * entri: inventaris menghitung rekaman per entri input, bukan
 * id unik.
 *
 * Parsing strict ber-index (prefiks record-inventory, pola
 * v349 sampai v360): entries bukan array, entri bukan objek,
 * recordId bukan string atau string kosong, kind bukan string
 * atau bukan salah satu dari 7 nilai enum DILEMPAR Error
 * ber-index, bukan difilter diam-diam.
 *
 * Deterministik: hanya hitungan per kategori, nihil pengurutan
 * list, sehingga dua urutan input berbeda menghasilkan objek
 * output identik. Nihil randomness, nihil jam sistem, nihil
 * I/O di jalur data.
 */

export type RecordKind =
  | 'person'
  | 'family'
  | 'source'
  | 'media'
  | 'note'
  | 'repository'
  | 'location'

export interface RecordEntry {
  recordId: string
  kind: RecordKind
}

export interface RecordInventoryResult {
  persons: number
  families: number
  core: number
  sources: number
  media: number
  notes: number
  repositories: number
  locations: number
  enrichment: number
  total: number
  densityPer100: number | null
}

const ERROR_PREFIX = 'record-inventory'

const VALID_KINDS = new Set<RecordKind>([
  'person',
  'family',
  'source',
  'media',
  'note',
  'repository',
  'location',
])

const KIND_FIELD: Record<
  RecordKind,
  keyof Pick<
    RecordInventoryResult,
    | 'persons'
    | 'families'
    | 'sources'
    | 'media'
    | 'notes'
    | 'repositories'
    | 'locations'
  >
> = {
  person: 'persons',
  family: 'families',
  source: 'sources',
  media: 'media',
  note: 'notes',
  repository: 'repositories',
  location: 'locations',
}

export function computeRecordInventory(
  entries: unknown,
): RecordInventoryResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX}: input entries harus array`)
  }

  const counts: Record<RecordKind, number> = {
    person: 0,
    family: 0,
    source: 0,
    media: 0,
    note: 0,
    repository: 0,
    location: 0,
  }

  entries.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} bukan objek`)
    }
    const item = entry as Record<string, unknown>
    if (typeof item.recordId !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} recordId harus string`,
      )
    }
    if (item.recordId.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} recordId tidak boleh string kosong`,
      )
    }
    if (typeof item.kind !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} kind harus string salah satu 7 nilai enum`,
      )
    }
    if (!VALID_KINDS.has(item.kind as RecordKind)) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} kind "${String(item.kind)}" bukan salah satu 7 nilai enum`,
      )
    }
    const kind = item.kind as RecordKind
    counts[kind] += 1
  })

  const persons = counts.person
  const families = counts.family
  const core = persons + families
  const sources = counts.source
  const media = counts.media
  const notes = counts.note
  const repositories = counts.repository
  const locations = counts.location
  const enrichment = sources + media + notes + repositories + locations
  const total = entries.length

  const densityPer100 =
    persons === 0 ? null : Math.round((enrichment * 1000) / persons) / 10

  return {
    persons,
    families,
    core,
    sources,
    media,
    notes,
    repositories,
    locations,
    enrichment,
    total,
    densityPer100,
  }
}
