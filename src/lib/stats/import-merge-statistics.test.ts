import { describe, expect, it } from 'vitest'
import {
  computeImportMergeStatistics,
  type ImportMergeStatisticsPayload,
  type ImportStatsPlan,
  type ImportStatsReport,
} from './import-merge-statistics'

/** Fixture dasar plan kosong, dipakai ulang tiap kasus. */
function emptyPlan(): ImportStatsPlan {
  return { entries: [], skipped: [], xrefMap: {} }
}

/** Fixture dasar report kosong. */
function emptyReport(): ImportStatsReport {
  return {
    createdMembers: [],
    duplicateXrefs: [],
    failedMembers: [],
    createdRelations: 0,
    skippedRelations: [],
    failedRelations: [],
    memberWarnings: [],
  }
}

function basePayload(overrides?: {
  plan?: Partial<ImportStatsPlan>
  report?: Partial<ImportStatsReport>
  treeBefore?: { persons: number; families: number }
}): ImportMergeStatisticsPayload {
  return {
    plan: { ...emptyPlan(), ...overrides?.plan },
    report: { ...emptyReport(), ...overrides?.report },
    treeBefore: overrides?.treeBefore ?? { persons: 0, families: 0 },
  }
}

describe('computeImportMergeStatistics', () => {
  it('kasus 1: import kosong valid, output nol, delta 0, treeAfter sama treeBefore', () => {
    const result = computeImportMergeStatistics(
      basePayload({ treeBefore: { persons: 40, families: 12 } }),
    )
    expect(result.personsIncoming).toBe(0)
    expect(result.familiesIncoming).toBe(0)
    expect(result.personsNew).toBe(0)
    expect(result.familiesNew).toBe(0)
    expect(result.matchCandidates.total).toBe(0)
    expect(result.matchCandidates).toEqual({ total: 0, byEXID: 0, byUID: 0, byREFN: 0 })
    expect(result.skippedInput.total).toBe(0)
    expect(result.skippedInput.byReason).toEqual({})
    expect(result.xrefsRemapped).toBe(0)
    expect(result.duplicatesDetected).toBe(0)
    expect(result.membersFailed).toBe(0)
    expect(result.relationsCreated).toBe(0)
    expect(result.relationsSkipped).toEqual({ total: 0, byReason: {} })
    expect(result.relationsFailed).toBe(0)
    expect(result.memberWarnings).toEqual({ total: 0, byWarning: {} })
    expect(result.treeBefore).toEqual({ persons: 40, families: 12 })
    expect(result.treeAfter).toEqual({ persons: 40, families: 12 })
    expect(result.delta).toEqual({ persons: 0, families: 0 })
  })

  it('kasus 2: campuran INDI dan FAM NEW dihitung per kategori', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'NEW' },
            { source: 'INDI', status: 'NEW' },
            { source: 'INDI', status: 'NEW' },
            { source: 'FAM', status: 'NEW' },
            { source: 'FAM', status: 'NEW' },
          ],
          skipped: [],
          xrefMap: { I1: '@M1@', I2: '@M2@', I3: '@M3@', F1: '@M4@', F2: '@M5@' },
        },
        treeBefore: { persons: 10, families: 3 },
      }),
    )
    expect(result.personsIncoming).toBe(3)
    expect(result.familiesIncoming).toBe(2)
    expect(result.personsNew).toBe(3)
    expect(result.familiesNew).toBe(2)
    expect(result.treeAfter).toEqual({ persons: 13, families: 5 })
    expect(result.delta).toEqual({ persons: 3, families: 2 })
    expect(result.xrefsRemapped).toBe(5)
  })

  it('kasus 3: breakdown byEXID byUID byREFN, kunci selalu lengkap walau satu jalur nol', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'EXID' },
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'EXID' },
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'UID' },
          ],
          skipped: [],
          xrefMap: {},
        },
      }),
    )
    expect(result.matchCandidates.total).toBe(3)
    expect(result.matchCandidates.byEXID).toBe(2)
    expect(result.matchCandidates.byUID).toBe(1)
    expect(result.matchCandidates.byREFN).toBe(0)
  })

  it('kasus 4: skipped masuk skippedInput byReason dan menambah incoming per source', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [{ source: 'INDI', status: 'NEW' }],
          skipped: [
            { source: 'INDI', reason: 'invalid-input' },
            { source: 'FAM', reason: 'invalid-input' },
            { source: 'INDI', reason: 'xref-duplicate' },
          ],
          xrefMap: {},
        },
      }),
    )
    expect(result.personsIncoming).toBe(3)
    expect(result.familiesIncoming).toBe(1)
    expect(result.skippedInput.total).toBe(3)
    expect(result.skippedInput.byReason).toEqual({ 'invalid-input': 2, 'xref-duplicate': 1 })
  })

  it('kasus 5: remap bertumpuk, banyak kunci xrefMap dihitung distinct jumlah kunci', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'NEW' },
            { source: 'INDI', status: 'NEW' },
          ],
          skipped: [],
          xrefMap: {
            I1: '@M1@',
            I2: '@M2@',
            I3: '@M3@',
            F1: '@M4@',
            F2: '@M5@',
            F3: '@M6@',
          },
        },
      }),
    )
    expect(result.xrefsRemapped).toBe(6)
    expect(result.delta).toEqual({ persons: 2, families: 0 })
  })

  it('kasus 6: semua duplikat, duplicatesDetected distinct, created tetap dilaporkan jujur', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        report: {
          createdMembers: [{ xref: 'I1' }],
          duplicateXrefs: ['I1', 'I1', 'I1'],
        },
      }),
    )
    expect(result.duplicatesDetected).toBe(1)
    expect(result.relationsCreated).toBe(0)
  })

  it('kasus 7: error parsial, failedMembers sebagian tanpa menggagalkan hitungan created', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'NEW' },
            { source: 'INDI', status: 'NEW' },
          ],
          skipped: [],
          xrefMap: { I1: '@M1@', I2: '@M2@' },
        },
        report: {
          createdMembers: [{ xref: 'I1' }, { xref: 'I2' }],
          failedMembers: [{ xref: 'I3', error: 'db-write-failed' }],
        },
        treeBefore: { persons: 5, families: 1 },
      }),
    )
    expect(result.membersFailed).toBe(1)
    expect(result.relationsCreated).toBe(0)
    expect(result.treeAfter).toEqual({ persons: 7, families: 1 })
  })

  it('kasus 8: distinct counting acuan v372, duplicateXrefs berulang dihitung sekali', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        report: {
          duplicateXrefs: ['I1', ' I1 ', 'I1', undefined, 'I2'],
        },
      }),
    )
    expect(result.duplicatesDetected).toBe(2)
  })

  it('kasus 9: invariant personsIncoming = personsNew + candidates + skippedPersons', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'NEW' },
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'EXID' },
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'UID' },
          ],
          skipped: [{ source: 'INDI', reason: 'invalid-input' }],
          xrefMap: {},
        },
      }),
    )
    expect(result.personsIncoming).toBe(4)
    expect(result.personsNew).toBe(1)
    expect(result.matchCandidates.total).toBe(2)
    expect(result.skippedInput.total).toBe(1)
    expect(
      result.personsNew + result.matchCandidates.total + result.skippedInput.total,
    ).toBe(result.personsIncoming)
  })

  it('kasus 10: invariant familiesIncoming mirror persons', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'FAM', status: 'NEW' },
            { source: 'FAM', status: 'MATCH_CANDIDATE', matchType: 'REFN' },
          ],
          skipped: [{ source: 'FAM', reason: 'invalid-input' }],
          xrefMap: {},
        },
      }),
    )
    expect(result.familiesIncoming).toBe(3)
    expect(result.familiesNew).toBe(1)
    expect(result.matchCandidates.total).toBe(1)
    expect(
      result.familiesNew + result.matchCandidates.total + result.skippedInput.total,
    ).toBe(result.familiesIncoming)
  })

  it('kasus 11: delta dan treeAfter konsisten dengan treeBefore plus New', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [
            { source: 'INDI', status: 'NEW' },
            { source: 'FAM', status: 'NEW' },
            { source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'EXID' },
          ],
          skipped: [],
          xrefMap: {},
        },
        treeBefore: { persons: 100, families: 30 },
      }),
    )
    expect(result.treeAfter).toEqual({ persons: 101, families: 31 })
    expect(result.delta).toEqual({ persons: 1, families: 1 })
  })

  it('kasus 12: memberWarnings total dan byWarning terurut', () => {
    const result = computeImportMergeStatistics(
      basePayload({
        report: {
          memberWarnings: [
            { xref: 'I1', warning: 'duplicate-xref' },
            { xref: 'I2', warning: 'no-xref' },
            { xref: 'I1', warning: 'duplicate-xref' },
          ],
        },
      }),
    )
    expect(result.memberWarnings.total).toBe(3)
    expect(result.memberWarnings.byWarning).toEqual({
      'duplicate-xref': 2,
      'no-xref': 1,
    })
    expect(Object.keys(result.memberWarnings.byWarning)).toEqual([
      'duplicate-xref',
      'no-xref',
    ])
  })

  it('kasus 13: payload invalid melempar Error ber-index', () => {
    expect(() => computeImportMergeStatistics(null)).toThrowError(/payload harus objek/)
    expect(() => computeImportMergeStatistics(undefined)).toThrowError(/payload harus objek/)
    expect(() => computeImportMergeStatistics([])).toThrowError(/payload harus objek/)
    expect(() =>
      computeImportMergeStatistics({ plan: null, report: {}, treeBefore: {} }),
    ).toThrowError(/plan harus objek/)
  })

  it('kasus 14: angka negatif dilempar', () => {
    expect(() =>
      computeImportMergeStatistics(
        basePayload({ treeBefore: { persons: -1, families: 0 } }),
      ),
    ).toThrowError(/harus integer non-negatif/)
    expect(() =>
      computeImportMergeStatistics(
        basePayload({ report: { createdRelations: -5 } }),
      ),
    ).toThrowError(/createdRelations harus integer non-negatif/)
  })

  it('kasus 15: non-integer dilempar', () => {
    expect(() =>
      computeImportMergeStatistics(
        basePayload({ treeBefore: { persons: 1.5, families: 0 } }),
      ),
    ).toThrowError(/harus integer non-negatif/)
    expect(() =>
      computeImportMergeStatistics(
        basePayload({ report: { createdRelations: 2.5 } }),
      ),
    ).toThrowError(/createdRelations harus integer non-negatif/)
  })

  it('kasus 16: kunci byReason deterministik terurut ASC lintas urutan input', () => {
    const a = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [],
          skipped: [
            { source: 'INDI', reason: 'zeta' },
            { source: 'INDI', reason: 'alpha' },
            { source: 'INDI', reason: 'mid' },
          ],
          xrefMap: {},
        },
      }),
    )
    const b = computeImportMergeStatistics(
      basePayload({
        plan: {
          entries: [],
          skipped: [
            { source: 'INDI', reason: 'alpha' },
            { source: 'INDI', reason: 'mid' },
            { source: 'INDI', reason: 'zeta' },
          ],
          xrefMap: {},
        },
      }),
    )
    expect(Object.keys(a.skippedInput.byReason)).toEqual(['alpha', 'mid', 'zeta'])
    expect(Object.keys(b.skippedInput.byReason)).toEqual(['alpha', 'mid', 'zeta'])
    expect(a).toEqual(b)
  })

  it('kasus 17: status invalid, source invalid, matchType invalid, dan MATCH_CANDIDATE tanpa matchType dilempar', () => {
    const badEntry = (entry: unknown) =>
      basePayload({
        plan: {
          entries: [entry as never],
          skipped: [],
          xrefMap: {},
        },
      })
    expect(() =>
      computeImportMergeStatistics(badEntry({ source: 'SRC', status: 'NEW' })),
    ).toThrowError(/source harus INDI atau FAM/)
    expect(() =>
      computeImportMergeStatistics(badEntry({ source: 'INDI', status: 'MERGED' })),
    ).toThrowError(/status harus NEW/)
    expect(() =>
      computeImportMergeStatistics(
        badEntry({ source: 'INDI', status: 'MATCH_CANDIDATE', matchType: 'VIBE' }),
      ),
    ).toThrowError(/matchType harus EXID, UID, atau REFN/)
    expect(() =>
      computeImportMergeStatistics(badEntry({ source: 'INDI', status: 'MATCH_CANDIDATE' })),
    ).toThrowError(/MATCH_CANDIDATE wajib punya matchType/)
  })

  it('kasus 18: reason, warning, atau error bukan string dilempar', () => {
    expect(() =>
      computeImportMergeStatistics(
        basePayload({
          plan: {
            entries: [],
            skipped: [{ source: 'INDI', reason: 42 as never }],
            xrefMap: {},
          },
        }),
      ),
    ).toThrowError(/reason harus string/)
    expect(() =>
      computeImportMergeStatistics(
        basePayload({
          report: { memberWarnings: [{ warning: null as never }] },
        }),
      ),
    ).toThrowError(/warning harus string/)
    expect(() =>
      computeImportMergeStatistics(
        basePayload({
          report: { failedRelations: [{ error: 7 as never }] },
        }),
      ),
    ).toThrowError(/error harus string/)
  })
})
