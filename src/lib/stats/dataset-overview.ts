/**
 * Dataset overview (v379 fase i): modul PURE ringkasan agregat
 * lintas modul statistik VISION-stemmagraph. Menggabungkan hasil
 * enam modul statistik yang sudah ada menjadi satu objek ringkasan
 * dengan headline numbers per modul plus field coverage.
 *
 * Sumber modul (semua pure, tanpa I/O):
 *   computeRecordInventory   -> totalRecords
 *   computeFamilySizeStats   -> avgFamilySize
 *   computeLivingStats       -> totalLiving
 *   computeSourceRecordStats -> totalSources, orphanCount
 *   computeCitationQuality   -> pctQuay3, quayDistribution
 *   computeCitationNoteStats -> percentWithNote
 *
 * Kontrak: computeDatasetOverview(input?) menerima objek opsional
 * dengan field opsional per modul. Field null, undefined, atau tak
 * disediakan di-skip tanpa crash dan coverage ikut turun. SEMUA
 * input nihil tetap menghasilkan objek valid dengan coverage
 * { included: [], count: 0 }, bukan throw. Input top-level yang
 * disediakan tapi bukan objek DILEMPAR Error ber-index. Field yang
 * disediakan tapi bentuknya bukan hasil modul asalnya juga DILEMPAR
 * Error ber-index (pola parser strict source-record-stats), bukan
 * difilter diam-diam.
 *
 * Angka modul asal di-pass-through tanpa pembulatan ulang. Satu
 * pengecualian: pctQuay3 adalah persentase agregat baru (share
 * sitasi quay "3" terhadap total sitasi), dibulatkan 2 desimal
 * via Math.round(x * 100) / 100.
 *
 * Deterministik: urutan properti input tidak memengaruhi output.
 * coverage.included selalu urut kanonik enam nama modul, hasil
 * pemanggilan ulang dengan data sama identik. Nihil randomness,
 * nihil jam sistem, nihil I/O di jalur data.
 */

import type { RecordInventoryResult } from './record-inventory'
import type { FamilySizeStats } from './family-size-stats'
import type { LivingStatsResult } from './living-stats'
import type { SourceRecordStats } from './source-record-stats'
import type {
  CitationQualityCount,
  CitationQualityResult,
} from './citation-quality'
import type { CitationNoteStats } from './citation-note-stats'

export interface DatasetOverviewInput {
  recordInventory?: RecordInventoryResult | null
  familySize?: FamilySizeStats | null
  living?: LivingStatsResult | null
  sourceRecords?: SourceRecordStats | null
  citationQuality?: CitationQualityResult | null
  citationNotes?: CitationNoteStats | null
}

export interface DatasetOverviewCoverage {
  included: string[]
  count: number
}

export interface DatasetOverviewResult {
  totalRecords: number | null
  avgFamilySize: number | null
  totalLiving: number | null
  totalSources: number | null
  orphanCount: number | null
  pctQuay3: number | null
  quayDistribution: CitationQualityCount[] | null
  percentWithNote: number | null
  coverage: DatasetOverviewCoverage
}

const ERROR_PREFIX = 'dataset-overview'

/** Urutan kanonik coverage, independen dari urutan properti input. */
const MODULE_KEYS = [
  'recordInventory',
  'familySize',
  'living',
  'sourceRecords',
  'citationQuality',
  'citationNotes',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function allFiniteNumbers(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every((key) => isFiniteNumber(value[key]))
}

function hasRecordInventoryShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  const numericKeys = [
    'persons', 'families', 'core', 'sources', 'media',
    'notes', 'repositories', 'locations', 'enrichment', 'total',
  ]
  if (!allFiniteNumbers(value, numericKeys)) return false
  const density = value.densityPer100
  return isFiniteNumber(density) || density === null
}

function hasFamilySizeShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    !allFiniteNumbers(value, [
      'average', 'median', 'max', 'familyCount', 'excludedCount',
    ])
  ) {
    return false
  }
  const distribution = value.distribution
  return (
    isRecord(distribution) &&
    allFiniteNumbers(distribution, ['zero', 'oneToTwo', 'threeToFour', 'fivePlus'])
  )
}

function hasLivingShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!allFiniteNumbers(value, ['total', 'living', 'deceased', 'unknownBirthDate'])) {
    return false
  }
  const generations = value.generations
  if (!isRecord(generations) || !allFiniteNumbers(generations, ['min', 'max'])) {
    return false
  }
  if (!isFiniteNumber(value.avgLifespanYears) && value.avgLifespanYears !== null) {
    return false
  }
  const ageBuckets = value.ageBuckets
  return (
    isRecord(ageBuckets) &&
    allFiniteNumbers(ageBuckets, [
      '0-17', '18-30', '31-45', '46-60', '61-75', '76+',
    ])
  )
}

function hasSourceRecordStatsShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isFiniteNumber(value.totalSources)) return false
  if (!Array.isArray(value.orphanXrefs)) return false
  const buckets = value.buckets
  if (
    !isRecord(buckets) ||
    !allFiniteNumbers(buckets, ['zero', 'one', 'twoToFour', 'fiveToNine', 'tenPlus'])
  ) {
    return false
  }
  const notes = value.notes
  if (
    !isRecord(notes) ||
    !allFiniteNumbers(notes, [
      'withNote', 'withoutNote', 'noteCount', 'snoteCount', 'totalNotes',
    ])
  ) {
    return false
  }
  return allFiniteNumbers(value, [
    'percentWithNote', 'avgNotesPerSource', 'danglingCitations',
  ])
}

function hasQuayCountEntry(entry: unknown): boolean {
  return (
    isRecord(entry) && typeof entry.value === 'string' && isFiniteNumber(entry.count)
  )
}

function hasCitationQualityShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!allFiniteNumbers(value, ['total', 'missingQuay'])) return false
  if (!Array.isArray(value.quayValues) || !value.quayValues.every(hasQuayCountEntry)) {
    return false
  }
  if (!Array.isArray(value.invalidQuay) || !value.invalidQuay.every(hasQuayCountEntry)) {
    return false
  }
  const notes = value.notes
  return isRecord(notes) && allFiniteNumbers(notes, ['withNote', 'withoutNote'])
}

function hasCitationNoteStatsShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  return allFiniteNumbers(value, [
    'total', 'withAnyNote', 'withoutNote', 'noteCount',
    'snoteCount', 'totalNotes', 'percentWithNote', 'avgNotesPerCitation',
  ])
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeDatasetOverview(
  input?: DatasetOverviewInput | null,
): DatasetOverviewResult {
  if (input === undefined || input === null) {
    return {
      totalRecords: null,
      avgFamilySize: null,
      totalLiving: null,
      totalSources: null,
      orphanCount: null,
      pctQuay3: null,
      quayDistribution: null,
      percentWithNote: null,
      coverage: { included: [], count: 0 },
    }
  }

  if (!isRecord(input)) {
    throw new Error(`${ERROR_PREFIX}: input harus objek atau dikosongkan`)
  }

  const raw = input as {
    recordInventory?: unknown
    familySize?: unknown
    living?: unknown
    sourceRecords?: unknown
    citationQuality?: unknown
    citationNotes?: unknown
  }

  let totalRecords: number | null = null
  let avgFamilySize: number | null = null
  let totalLiving: number | null = null
  let totalSources: number | null = null
  let orphanCount: number | null = null
  let pctQuay3: number | null = null
  let quayDistribution: CitationQualityCount[] | null = null
  let percentWithNote: number | null = null
  const included: string[] = []

  if (raw.recordInventory !== undefined && raw.recordInventory !== null) {
    if (!hasRecordInventoryShape(raw.recordInventory)) {
      throw new Error(
        `${ERROR_PREFIX}.recordInventory: bukan hasil computeRecordInventory yang valid`,
      )
    }
    totalRecords = (raw.recordInventory as RecordInventoryResult).total
    included.push('recordInventory')
  }

  if (raw.familySize !== undefined && raw.familySize !== null) {
    if (!hasFamilySizeShape(raw.familySize)) {
      throw new Error(
        `${ERROR_PREFIX}.familySize: bukan hasil computeFamilySizeStats yang valid`,
      )
    }
    avgFamilySize = (raw.familySize as FamilySizeStats).average
    included.push('familySize')
  }

  if (raw.living !== undefined && raw.living !== null) {
    if (!hasLivingShape(raw.living)) {
      throw new Error(
        `${ERROR_PREFIX}.living: bukan hasil computeLivingStats yang valid`,
      )
    }
    totalLiving = (raw.living as LivingStatsResult).living
    included.push('living')
  }

  if (raw.sourceRecords !== undefined && raw.sourceRecords !== null) {
    if (!hasSourceRecordStatsShape(raw.sourceRecords)) {
      throw new Error(
        `${ERROR_PREFIX}.sourceRecords: bukan hasil computeSourceRecordStats yang valid`,
      )
    }
    const modul = raw.sourceRecords as SourceRecordStats
    totalSources = modul.totalSources
    orphanCount = modul.orphanXrefs.length
    included.push('sourceRecords')
  }

  if (raw.citationQuality !== undefined && raw.citationQuality !== null) {
    if (!hasCitationQualityShape(raw.citationQuality)) {
      throw new Error(
        `${ERROR_PREFIX}.citationQuality: bukan hasil computeCitationQuality yang valid`,
      )
    }
    const modul = raw.citationQuality as CitationQualityResult
    quayDistribution = modul.quayValues
    const quay3 = modul.quayValues.find((entry) => entry.value === '3')
    const count3 = quay3 === undefined ? 0 : quay3.count
    pctQuay3 = modul.total === 0 ? 0 : round2((100 * count3) / modul.total)
    included.push('citationQuality')
  }

  if (raw.citationNotes !== undefined && raw.citationNotes !== null) {
    if (!hasCitationNoteStatsShape(raw.citationNotes)) {
      throw new Error(
        `${ERROR_PREFIX}.citationNotes: bukan hasil computeCitationNoteStats yang valid`,
      )
    }
    percentWithNote = (raw.citationNotes as CitationNoteStats).percentWithNote
    included.push('citationNotes')
  }

  return {
    totalRecords,
    avgFamilySize,
    totalLiving,
    totalSources,
    orphanCount,
    pctQuay3,
    quayDistribution,
    percentWithNote,
    coverage: { included, count: included.length },
  }
}
