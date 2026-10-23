import { describe, expect, it } from 'vitest'
import { computeDatasetOverview } from './dataset-overview'
import { computeRecordInventory, type RecordEntry } from './record-inventory'
import { computeFamilySizeStats, type FamilySizeInput } from './family-size-stats'
import { computeLivingStats, type LivingStatsMember } from './living-stats'
import {
  computeSourceRecordStats,
  type SourceRecordStatsCitation,
  type SourceRecordStatsSource,
} from './source-record-stats'
import { computeCitationQuality, type CitationQualityEntry } from './citation-quality'
import { computeCitationNoteStats, type CitationNoteStatsEntry } from './citation-note-stats'

const INVENTORY_ENTRIES: RecordEntry[] = [
  { recordId: '@I1@', kind: 'person' },
  { recordId: '@I2@', kind: 'person' },
  { recordId: '@F1@', kind: 'family' },
  { recordId: '@S1@', kind: 'source' },
  { recordId: '@M1@', kind: 'media' },
]

const FAMILIES: FamilySizeInput[] = [
  { childIds: ['a', 'b', 'c'] },
  { childIds: ['d'] },
  { childIds: [] },
]

const MEMBERS: LivingStatsMember[] = [
  { birthDate: '1980-05-10', deathDate: null, isAlive: true, generation: 2 },
  { birthDate: '2001-01-15', deathDate: null, isAlive: true, generation: 3 },
  { birthDate: '1930-03-03', deathDate: '2000-07-07', isAlive: false, generation: 1 },
]

const SOURCES: SourceRecordStatsSource[] = [
  { xref: '@S1@', note: 'catatan sumber' },
  { xref: '@S2@' },
  { xref: '@S3@' },
]

const CITATIONS: SourceRecordStatsCitation[] = [
  { sourcePointer: '@S1@' },
  { sourcePointer: '@S1@' },
  { sourcePointer: '@S2@' },
]

const QUALITY_ENTRIES: CitationQualityEntry[] = [
  { sourcePointer: '@S1@', quay: '3' },
  { sourcePointer: '@S2@', quay: '3' },
  { sourcePointer: '@S3@', quay: '0' },
  { sourcePointer: '@S4@' },
]

const NOTE_ENTRIES: CitationNoteStatsEntry[] = [
  { sourcePointer: '@S1@', note: 'n1' },
  { sourcePointer: '@S2@', snote: 'n2' },
  { sourcePointer: '@S3@' },
  { sourcePointer: '@S4@', note: '  ' },
]

function fullInput() {
  return {
    recordInventory: computeRecordInventory(INVENTORY_ENTRIES),
    familySize: computeFamilySizeStats(FAMILIES),
    living: computeLivingStats(MEMBERS, new Date('2026-06-15T00:00:00Z')),
    sourceRecords: computeSourceRecordStats({ sources: SOURCES, citations: CITATIONS }),
    citationQuality: computeCitationQuality(QUALITY_ENTRIES),
    citationNotes: computeCitationNoteStats(NOTE_ENTRIES),
  }
}

describe('computeDatasetOverview', () => {
  it('kasus 1: tanpa argumen menghasilkan objek valid coverage kosong', () => {
    const r = computeDatasetOverview()
    expect(r.coverage).toEqual({ included: [], count: 0 })
    expect(r.totalRecords).toBeNull()
    expect(r.avgFamilySize).toBeNull()
    expect(r.totalLiving).toBeNull()
    expect(r.totalSources).toBeNull()
    expect(r.orphanCount).toBeNull()
    expect(r.pctQuay3).toBeNull()
    expect(r.quayDistribution).toBeNull()
    expect(r.percentWithNote).toBeNull()
  })

  it('kasus 2: input null eksplisit sama dengan tanpa argumen', () => {
    expect(computeDatasetOverview(null)).toEqual(computeDatasetOverview())
  })

  it('kasus 3: objek kosong di-skip semua, coverage count 0, tidak throw', () => {
    const r = computeDatasetOverview({})
    expect(r.coverage).toEqual({ included: [], count: 0 })
    expect(r.totalRecords).toBeNull()
  })

  it('kasus 4: modul tunggal recordInventory, headline totalRecords pass-through', () => {
    const inv = computeRecordInventory(INVENTORY_ENTRIES)
    const r = computeDatasetOverview({ recordInventory: inv })
    expect(r.totalRecords).toBe(inv.total)
    expect(r.coverage).toEqual({ included: ['recordInventory'], count: 1 })
    expect(r.avgFamilySize).toBeNull()
  })

  it('kasus 5: modul tunggal familySize, headline avgFamilySize dari average', () => {
    const fs = computeFamilySizeStats(FAMILIES)
    const r = computeDatasetOverview({ familySize: fs })
    expect(r.avgFamilySize).toBe(fs!.average)
    expect(r.coverage).toEqual({ included: ['familySize'], count: 1 })
  })

  it('kasus 6: modul tunggal living, headline totalLiving dari living', () => {
    const lv = computeLivingStats(MEMBERS, new Date('2026-06-15T00:00:00Z'))
    const r = computeDatasetOverview({ living: lv })
    expect(r.totalLiving).toBe(lv.living)
    expect(r.totalLiving).toBe(2)
    expect(r.coverage).toEqual({ included: ['living'], count: 1 })
  })

  it('kasus 7: modul tunggal sourceRecords, totalSources plus orphanCount', () => {
    const sr = computeSourceRecordStats({ sources: SOURCES, citations: CITATIONS })
    const r = computeDatasetOverview({ sourceRecords: sr })
    expect(r.totalSources).toBe(3)
    expect(r.orphanCount).toBe(1)
    expect(r.coverage).toEqual({ included: ['sourceRecords'], count: 1 })
  })

  it('kasus 8: modul tunggal citationQuality, pctQuay3 dibulatkan 2 desimal', () => {
    const cq = computeCitationQuality(QUALITY_ENTRIES)
    const r = computeDatasetOverview({ citationQuality: cq })
    expect(r.pctQuay3).toBe(50)
    expect(r.quayDistribution).toEqual(cq!.quayValues)
    expect(r.coverage).toEqual({ included: ['citationQuality'], count: 1 })
  })

  it('kasus 9: modul tunggal citationNotes, percentWithNote pass-through', () => {
    const cn = computeCitationNoteStats(NOTE_ENTRIES)
    const r = computeDatasetOverview({ citationNotes: cn })
    expect(r.percentWithNote).toBe(cn!.percentWithNote)
    expect(r.coverage).toEqual({ included: ['citationNotes'], count: 1 })
  })

  it('kasus 10: kombinasi recordInventory + familySize, coverage 2 urut kanonik', () => {
    const data = fullInput()
    const r = computeDatasetOverview({
      familySize: data.familySize,
      recordInventory: data.recordInventory,
    })
    expect(r.coverage).toEqual({ included: ['recordInventory', 'familySize'], count: 2 })
    expect(r.totalRecords).toBe(5)
    expect(r.avgFamilySize).toBe(data.familySize!.average)
  })

  it('kasus 11: kombinasi sourceRecords + citationQuality, coverage 2', () => {
    const data = fullInput()
    const r = computeDatasetOverview({
      citationQuality: data.citationQuality,
      sourceRecords: data.sourceRecords,
    })
    expect(r.coverage).toEqual({ included: ['sourceRecords', 'citationQuality'], count: 2 })
    expect(r.totalSources).toBe(3)
    expect(r.pctQuay3).toBe(50)
  })

  it('kasus 12: kombinasi living + citationNotes, coverage 2', () => {
    const data = fullInput()
    const r = computeDatasetOverview({
      citationNotes: data.citationNotes,
      living: data.living,
    })
    expect(r.coverage).toEqual({ included: ['living', 'citationNotes'], count: 2 })
    expect(r.totalLiving).toBe(2)
  })

  it('kasus 13: keenam modul lengkap, coverage included 6 urut kanonik', () => {
    const r = computeDatasetOverview(fullInput())
    expect(r.coverage.included).toEqual([
      'recordInventory',
      'familySize',
      'living',
      'sourceRecords',
      'citationQuality',
      'citationNotes',
    ])
    expect(r.coverage.count).toBe(6)
    expect(r.totalRecords).toBe(5)
    expect(r.avgFamilySize).not.toBeNull()
    expect(r.totalLiving).toBe(2)
    expect(r.totalSources).toBe(3)
    expect(r.orphanCount).toBe(1)
    expect(r.pctQuay3).toBe(50)
    expect(r.percentWithNote).toBe(75)
  })

  it('kasus 14: semua field null eksplisit menghasilkan objek valid coverage kosong', () => {
    const r = computeDatasetOverview({
      recordInventory: null,
      familySize: null,
      living: null,
      sourceRecords: null,
      citationQuality: null,
      citationNotes: null,
    })
    expect(r.coverage).toEqual({ included: [], count: 0 })
    expect(r.totalRecords).toBeNull()
    expect(r.percentWithNote).toBeNull()
  })

  it('kasus 15: nilai nol di recordInventory tetap masuk coverage', () => {
    const r = computeDatasetOverview({ recordInventory: computeRecordInventory([]) })
    expect(r.totalRecords).toBe(0)
    expect(r.coverage.count).toBe(1)
  })

  it('kasus 16: nilai nol di familySize (null dari modul asal) di-skip', () => {
    const r = computeDatasetOverview({ familySize: computeFamilySizeStats([]) })
    expect(r.avgFamilySize).toBeNull()
    expect(r.coverage).toEqual({ included: [], count: 0 })
  })

  it('kasus 17: nilai nol di living (members kosong) tetap masuk coverage', () => {
    const lv = computeLivingStats([], new Date('2026-06-15T00:00:00Z'))
    const r = computeDatasetOverview({ living: lv })
    expect(r.totalLiving).toBe(0)
    expect(r.coverage.count).toBe(1)
  })

  it('kasus 18: nilai nol di sourceRecords (semua kosong = null) di-skip', () => {
    const sr = computeSourceRecordStats({ sources: [], citations: [] })
    const r = computeDatasetOverview({ sourceRecords: sr })
    expect(r.totalSources).toBeNull()
    expect(r.coverage).toEqual({ included: [], count: 0 })
  })

  it('kasus 19: citationQuality dengan quay nihil, pctQuay3 fallback 0 tanpa NaN', () => {
    const cq = computeCitationQuality([
      { sourcePointer: '@S1@' },
      { sourcePointer: '@S2@', quay: 'x' },
    ])
    const r = computeDatasetOverview({ citationQuality: cq })
    expect(r.pctQuay3).toBe(0)
    expect(r.coverage.count).toBe(1)
  })

  it('kasus 20: citationNotes kosong (null dari modul asal) di-skip', () => {
    const r = computeDatasetOverview({ citationNotes: computeCitationNoteStats([]) })
    expect(r.percentWithNote).toBeNull()
    expect(r.coverage).toEqual({ included: [], count: 0 })
  })

  it('kasus 21: determinisme urutan properti input, output identik', () => {
    const data = fullInput()
    const a = computeDatasetOverview({
      recordInventory: data.recordInventory,
      familySize: data.familySize,
      living: data.living,
      sourceRecords: data.sourceRecords,
      citationQuality: data.citationQuality,
      citationNotes: data.citationNotes,
    })
    const b = computeDatasetOverview({
      citationNotes: data.citationNotes,
      citationQuality: data.citationQuality,
      sourceRecords: data.sourceRecords,
      living: data.living,
      familySize: data.familySize,
      recordInventory: data.recordInventory,
    })
    expect(a).toEqual(b)
    expect(a.coverage.included).toEqual([
      'recordInventory',
      'familySize',
      'living',
      'sourceRecords',
      'citationQuality',
      'citationNotes',
    ])
  })

  it('kasus 22: bentuk coverage benar, included adalah string dan count panjangnya', () => {
    const data = fullInput()
    const r = computeDatasetOverview({
      recordInventory: data.recordInventory,
      citationNotes: data.citationNotes,
    })
    expect(r.coverage.count).toBe(r.coverage.included.length)
    r.coverage.included.forEach((name) => expect(typeof name).toBe('string'))
  })

  it('kasus 23: input top-level bukan objek dilempar Error ber-index', () => {
    expect(() => computeDatasetOverview('bukan objek' as unknown as undefined)).toThrow(
      /dataset-overview/,
    )
    expect(() => computeDatasetOverview([1, 2] as unknown as undefined)).toThrow(
      /dataset-overview/,
    )
  })

  it('kasus 24: field tersedia tapi bentuknya salah dilempar Error ber-index', () => {
    expect(() =>
      computeDatasetOverview({ recordInventory: { total: 'bukan angka' } as never }),
    ).toThrow(/dataset-overview\.recordInventory/)
    expect(() =>
      computeDatasetOverview({ living: { total: 1 } as never }),
    ).toThrow(/dataset-overview\.living/)
    expect(() =>
      computeDatasetOverview({ citationNotes: { total: 1 } as never }),
    ).toThrow(/dataset-overview\.citationNotes/)
  })

  it('kasus 25: pctQuay3 pecahan dibulatkan tepat 2 desimal', () => {
    const cq = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '3' },
      { sourcePointer: '@S2@', quay: '3' },
      { sourcePointer: '@S3@', quay: '3' },
      { sourcePointer: '@S4@', quay: '1' },
      { sourcePointer: '@S5@', quay: '1' },
      { sourcePointer: '@S6@', quay: '1' },
      { sourcePointer: '@S7@', quay: '1' },
    ])
    const r = computeDatasetOverview({ citationQuality: cq })
    expect(r.pctQuay3).toBe(42.86)
    const eksak = Math.round((100 * 3) / 7 * 100) / 100
    expect(r.pctQuay3).toBe(eksak)
  })
})
