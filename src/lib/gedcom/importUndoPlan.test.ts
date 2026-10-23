import { describe, expect, it } from 'vitest'
import { buildUndoPlan, type UndoPlanPayload } from './importUndoPlan'
import type { ImportApplyReport } from './applyImportPlan'

/** Report kosong bentuk nyata ImportApplyReport. */
function emptyReport(): ImportApplyReport {
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

function payload(
  overrides?: Partial<{ report: Partial<ImportApplyReport>; existingIds: string[] }>,
): UndoPlanPayload {
  return {
    report: { ...emptyReport(), ...overrides?.report },
    existingIds: overrides?.existingIds ?? [],
  }
}

describe('buildUndoPlan', () => {
  it('kasus 1: import bersih, semua id baru masuk delete list urut kemunculan', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ xref: 'I1', id: 'm1' }, { xref: 'I2', id: 'm2' }, { xref: 'I3', id: 'm3' }],
          createdRelations: 4,
        },
        existingIds: ['old1', 'old2'],
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm2', 'm3'])
    expect(result.conflicts).toEqual([])
    expect(result.safe).toBe(true)
    expect(result.relationCountToReverse).toBe(4)
  })

  it('kasus 2: id duplikat di createdMembers dihilangkan, kemunculan pertama menang', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ xref: 'I1', id: 'm1' }, { xref: 'I1', id: 'm1' }, { xref: 'I2', id: 'm2' }],
        },
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm2'])
    expect(result.safe).toBe(true)
  })

  it('kasus 3: id sudah ada di existingIds masuk conflicts dan keluar dari delete list', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ xref: 'I1', id: 'old1' }, { xref: 'I2', id: 'm2' }],
        },
        existingIds: ['old1'],
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m2'])
    expect(result.conflicts).toEqual([
      { id: 'old1', detail: 'conflict existing-tree: id sudah ada sebelum import' },
    ])
    expect(result.safe).toBe(false)
  })

  it('kasus 4: safe true tanpa konflik', () => {
    const result = buildUndoPlan(
      payload({ report: { createdMembers: [{ id: 'm1' }] }, existingIds: ['old1'] }),
    )
    expect(result.safe).toBe(true)
    expect(result.conflicts).toEqual([])
  })

  it('kasus 5: safe false dengan konflik, konflik distinct per id', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ xref: 'I1', id: 'old1' }, { xref: 'I1', id: 'old1' }, { xref: 'I2', id: 'old2' }],
        },
        existingIds: ['old1', 'old2'],
      }),
    )
    expect(result.conflicts).toHaveLength(2)
    expect(result.safe).toBe(false)
  })

  it('kasus 6: relationCountToReverse mirror createdRelations apa adanya', () => {
    const result = buildUndoPlan(
      payload({ report: { createdRelations: 27 }, existingIds: [] }),
    )
    expect(result.relationCountToReverse).toBe(27)
  })

  it('kasus 7: failedMembers tidak memengaruhi plan', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ id: 'm1' }],
          failedMembers: [{ xref: 'I9', error: 'db-write-failed' }],
        },
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1'])
    expect(result.conflicts).toEqual([])
    expect(result.safe).toBe(true)
  })

  it('kasus 8: skippedRelations tidak memengaruhi plan', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ id: 'm1' }],
          skippedRelations: [{ memberXref: 'I1', relatedXref: 'I2', reason: 'unknown-xref' }],
        },
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1'])
    expect(result.safe).toBe(true)
  })

  it('kasus 9: duplicateXrefs tidak memengaruhi plan', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [{ id: 'm1' }],
          duplicateXrefs: ['I1', 'I1'],
        },
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1'])
    expect(result.safe).toBe(true)
  })

  it('kasus 10: createdMembers tanpa xref tetap diproses lewat id', () => {
    const result = buildUndoPlan(
      payload({ report: { createdMembers: [{ id: 'm1' }, { id: 'm2' }] } }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm2'])
    expect(result.safe).toBe(true)
  })

  it('kasus 11: existingIds kosong berarti semua created masuk delete', () => {
    const result = buildUndoPlan(
      payload({ report: { createdMembers: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] } }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm2', 'm3'])
    expect(result.safe).toBe(true)
  })

  it('kasus 12: report kosong adalah import kosong sah, plan valid kosong safe true', () => {
    const result = buildUndoPlan(payload())
    expect(result).toEqual({
      memberIdsToDelete: [],
      relationCountToReverse: 0,
      safe: true,
      conflicts: [],
    })
  })

  it('kasus 13: bentuk buruk beragam semua plan kosong tanpa lempar', () => {
    expect(buildUndoPlan(null).conflicts[0]?.detail).toBe('invalid-input')
    expect(buildUndoPlan(undefined).conflicts[0]?.detail).toBe('invalid-input')
    expect(buildUndoPlan([]).conflicts[0]?.detail).toBe('invalid-input')
    expect(buildUndoPlan('x').conflicts[0]?.detail).toBe('invalid-input')
    expect(buildUndoPlan({ report: null, existingIds: [] }).conflicts[0]?.detail).toBe(
      'invalid-input',
    )
    expect(buildUndoPlan({ report: {}, existingIds: 'nope' }).conflicts[0]?.detail).toBe(
      'invalid-input',
    )
    expect(
      buildUndoPlan({ report: { createdMembers: 'nope' }, existingIds: [] }).conflicts[0]
        ?.detail,
    ).toBe('invalid-input')
  })

  it('kasus 14: urutan delete list deterministik lintas urutan input existingIds', () => {
    const a = buildUndoPlan(
      payload({
        report: { createdMembers: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] },
        existingIds: ['z9', 'a9'],
      }),
    )
    const b = buildUndoPlan(
      payload({
        report: { createdMembers: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] },
        existingIds: ['a9', 'z9'],
      }),
    )
    expect(a.memberIdsToDelete).toEqual(['m1', 'm2', 'm3'])
    expect(b.memberIdsToDelete).toEqual(['m1', 'm2', 'm3'])
    expect(a).toEqual(b)
  })

  it('kasus 15: kombinasi konflik parsial, sebagian konflik sebagian bersih', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [
            { xref: 'I1', id: 'm1' },
            { xref: 'I2', id: 'old1' },
            { xref: 'I3', id: 'm3' },
            { xref: 'I4', id: 'old2' },
          ],
          createdRelations: 3,
        },
        existingIds: ['old1', 'old2'],
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm3'])
    expect(result.conflicts.map((c) => c.id)).toEqual(['old1', 'old2'])
    expect(result.safe).toBe(false)
    expect(result.relationCountToReverse).toBe(3)
  })

  it('kasus 16: entri jelek per item di-skip tanpa lempar, sisanya tetap diproses', () => {
    const result = buildUndoPlan(
      payload({
        report: {
          createdMembers: [
            { id: 'm1' },
            null as never,
            { id: 42 as never },
            { id: 'm2' },
          ],
        },
      }),
    )
    expect(result.memberIdsToDelete).toEqual(['m1', 'm2'])
    expect(result.safe).toBe(true)
  })

  it('kasus 17: createdRelations bukan angka berhingga dianggap 0 tanpa lempar', () => {
    const result = buildUndoPlan(
      payload({ report: { createdRelations: Number.NaN }, existingIds: [] }),
    )
    expect(result.relationCountToReverse).toBe(0)
    expect(result.safe).toBe(true)
  })
})
