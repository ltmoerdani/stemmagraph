// Test applyImportPlan (S1F6-B): adapter palsu in-memory berupa callback
// sederhana, tanpa DB nyata. Kasus mencakup happy path, ketahanan error
// (member maupun relasi), guard self loop, unknown xref, duplikat, member
// tanpa xref, urutan fase, akurasi hitungan, plan kosong, dan representasi
// tanggal ParsedEventDate ke string.

import { describe, expect, it } from 'vitest'
import { applyImportPlan } from './applyImportPlan'
import type { CreateMemberInput, ImportApplyIO } from './applyImportPlan'
import type { ImportPlan, PlannedMember } from './importPlan'
import type { ParsedEventDate } from './parseEventDate'

/** Member plan minimal; field opsional dibiarkan kosong. */
function member(xref: string | undefined, name: string | undefined): PlannedMember {
  return {
    xref,
    name,
    gender: 'other',
    birthDate: undefined,
    birthPlace: undefined,
    deathDate: undefined,
    deathPlace: undefined,
  }
}

/** Plan dengan arrays wajib; skipped tidak dipakai di level apply. */
function plan(
  members: PlannedMember[],
  relationships: ImportPlan['relationships'] = [],
): ImportPlan {
  return { members, relationships, skipped: [] }
}

interface RelationCall {
  treeId: string
  memberId: string
  relatedId: string
  type: 'spouse' | 'parent'
}

interface FakeIO {
  io: ImportApplyIO
  /** Urutan panggilan: 'member:<name>:<id>' lalu 'relation:<a>-><b>:<t>'. */
  log: string[]
  memberInputs: CreateMemberInput[]
  relationCalls: RelationCall[]
}

/**
 * Adapter palsu in-memory: id berurutan m1, m2, dan seterusnya. Kegagalan
 * dipicu lewat daftar nama member atau pasangan id 'a->b' relasi.
 */
function makeFakeIO(opts: {
  failMemberNames?: string[]
  failRelationPairs?: string[]
  treeId?: string
} = {}): FakeIO {
  const log: string[] = []
  const memberInputs: CreateMemberInput[] = []
  const relationCalls: RelationCall[] = []
  let seq = 0
  const io: ImportApplyIO = {
    treeId: opts.treeId ?? 'tree-1',
    async createMember(input) {
      memberInputs.push(input)
      if (opts.failMemberNames?.includes(input.name)) {
        throw new Error(`boom-member:${input.name}`)
      }
      const id = `m${++seq}`
      log.push(`member:${input.name}:${id}`)
      return id
    },
    async createRelation(treeId, memberId, relatedId, type) {
      relationCalls.push({ treeId, memberId, relatedId, type })
      if (opts.failRelationPairs?.includes(`${memberId}->${relatedId}`)) {
        throw new Error('boom-relation')
      }
      log.push(`relation:${memberId}->${relatedId}:${type}`)
    },
  }
  return { io, log, memberInputs, relationCalls }
}

describe('applyImportPlan', () => {
  it('happy path: 2 member, 1 spouse, 1 parent, semua tercatat dengan id terpetakan', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(
      plan(
        [member('I1', 'Ayah'), member('I2', 'Anak')],
        [
          { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I2', type: 'parent' },
        ],
      ),
      fake.io,
    )
    expect(report.createdMembers).toEqual([
      { xref: 'I1', id: 'm1' },
      { xref: 'I2', id: 'm2' },
    ])
    expect(report.createdRelations).toBe(2)
    expect(report.failedMembers).toEqual([])
    expect(report.failedRelations).toEqual([])
    expect(report.skippedRelations).toEqual([])
    expect(report.duplicateXrefs).toEqual([])
    expect(fake.relationCalls).toEqual([
      { treeId: 'tree-1', memberId: 'm1', relatedId: 'm2', type: 'spouse' },
      { treeId: 'tree-1', memberId: 'm1', relatedId: 'm2', type: 'parent' },
    ])
  })

  it('error createMember tidak menghentikan member berikutnya', async () => {
    const fake = makeFakeIO({ failMemberNames: ['B'] })
    const report = await applyImportPlan(
      plan([member('I1', 'A'), member('I2', 'B'), member('I3', 'C')]),
      fake.io,
    )
    expect(report.failedMembers).toEqual([
      { xref: 'I2', error: 'boom-member:B' },
    ])
    expect(report.createdMembers.map((m) => m.xref)).toEqual(['I1', 'I3'])
    expect(fake.memberInputs).toHaveLength(3)
  })

  it('relasi yang menyentuh member gagal dibuat di-skip unknown-xref tanpa lempar', async () => {
    const fake = makeFakeIO({ failMemberNames: ['B'] })
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A'), member('I2', 'B')],
        [{ memberXref: 'I1', relatedXref: 'I2', type: 'spouse' }],
      ),
      fake.io,
    )
    expect(report.skippedRelations).toEqual([
      { memberXref: 'I1', relatedXref: 'I2', reason: 'unknown-xref' },
    ])
    expect(report.createdRelations).toBe(0)
    expect(fake.relationCalls).toEqual([])
  })

  it('self loop di-skip dengan alasan self-loop meski xref dikenal', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A')],
        [{ memberXref: 'I1', relatedXref: 'I1', type: 'spouse' }],
      ),
      fake.io,
    )
    expect(report.skippedRelations).toEqual([
      { memberXref: 'I1', relatedXref: 'I1', reason: 'self-loop' },
    ])
    expect(report.createdRelations).toBe(0)
    expect(fake.relationCalls).toEqual([])
  })

  it('xref duplikat: member dibuat sekali, duplikat warning dan memakai id yang sama', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A'), member('I1', 'A-lagi'), member('I2', 'B')],
        [{ memberXref: 'I1', relatedXref: 'I2', type: 'parent' }],
      ),
      fake.io,
    )
    expect(report.duplicateXrefs).toEqual(['I1'])
    expect(report.memberWarnings).toEqual([
      { xref: 'I1', warning: 'duplicate-xref' },
    ])
    expect(report.createdMembers).toEqual([
      { xref: 'I1', id: 'm1' },
      { xref: 'I1', id: 'm1' },
      { xref: 'I2', id: 'm2' },
    ])
    expect(fake.memberInputs).toHaveLength(2)
    expect(fake.relationCalls[0].memberId).toBe('m1')
    expect(report.createdRelations).toBe(1)
  })

  it('member tanpa xref tetap dibuat, id tercatat tanpa kunci map, warning no-xref', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(plan([member(undefined, 'TanpaXref')]), fake.io)
    expect(report.createdMembers).toEqual([{ xref: undefined, id: 'm1' }])
    expect(report.memberWarnings).toEqual([
      { xref: undefined, warning: 'no-xref' },
    ])
    expect(report.failedMembers).toEqual([])
  })

  it('urutan pemanggilan: semua members dulu, baru relations', async () => {
    const fake = makeFakeIO()
    await applyImportPlan(
      plan(
        [member('I1', 'A'), member('I2', 'B'), member('I3', 'C')],
        [
          { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
        ],
      ),
      fake.io,
    )
    const firstRelationIndex = fake.log.findIndex((e) => e.startsWith('relation:'))
    const memberIndexes = fake.log
      .map((e, i) => (e.startsWith('member:') ? i : -1))
      .filter((i) => i >= 0)
    expect(firstRelationIndex).toBeGreaterThan(-1)
    for (const index of memberIndexes) {
      expect(index).toBeLessThan(firstRelationIndex)
    }
    expect(fake.log.filter((e) => e.startsWith('member:'))).toHaveLength(3)
  })

  it('laporan createdRelations akurat di tengah campuran skip dan gagal', async () => {
    const fake = makeFakeIO({
      failMemberNames: ['X-gagal'],
      failRelationPairs: ['m1->m3'],
    })
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A'), member('I2', 'B'), member('I3', 'C'), member('I9', 'X-gagal')],
        [
          { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I1', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I9', type: 'parent' },
          { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
        ],
      ),
      fake.io,
    )
    expect(report.createdRelations).toBe(1)
    expect(report.skippedRelations).toEqual([
      { memberXref: 'I1', relatedXref: 'I1', reason: 'self-loop' },
      { memberXref: 'I1', relatedXref: 'I9', reason: 'unknown-xref' },
    ])
    expect(report.failedRelations).toEqual([
      { memberXref: 'I1', relatedXref: 'I3', error: 'boom-relation' },
    ])
  })

  it('plan kosong menghasilkan report kosong tanpa panggilan adapter', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(plan([], []), fake.io)
    expect(report).toEqual({
      createdMembers: [],
      duplicateXrefs: [],
      failedMembers: [],
      createdRelations: 0,
      skippedRelations: [],
      failedRelations: [],
      memberWarnings: [],
    })
    expect(fake.memberInputs).toEqual([])
    expect(fake.relationCalls).toEqual([])
  })

  it('createRelation melempar: tercatat di failedRelations, relasi berikutnya tetap jalan', async () => {
    const fake = makeFakeIO({ failRelationPairs: ['m1->m2'] })
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A'), member('I2', 'B'), member('I3', 'C')],
        [
          { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
        ],
      ),
      fake.io,
    )
    expect(report.failedRelations).toEqual([
      { memberXref: 'I1', relatedXref: 'I2', error: 'boom-relation' },
    ])
    expect(report.createdRelations).toBe(1)
    expect(fake.relationCalls).toHaveLength(2)
  })

  it('tanggal ParsedEventDate jadi string via formatter, fallback teks asli bila null', async () => {
    const fake = makeFakeIO()
    const exact: ParsedEventDate = {
      dateKind: 'EXACT',
      year: 1900,
      month: 1,
      day: 12,
      originalDateString: '12 JAN 1900',
    }
    const unparseable: ParsedEventDate = {
      dateKind: 'ABOUT',
      originalDateString: 'ABT SUATU WAKTU',
    }
    const withDates: PlannedMember = {
      ...member('I1', 'A'),
      birthDate: exact,
      deathDate: unparseable,
      birthPlace: 'Surabaya',
    }
    await applyImportPlan(plan([withDates]), fake.io)
    expect(fake.memberInputs[0]).toEqual({
      name: 'A',
      gender: 'other',
      birthDate: '12 JAN 1900',
      deathDate: 'ABT SUATU WAKTU',
      birthPlace: 'Surabaya',
    })
  })

  it('relasi dengan kedua xref tidak dikenal di-skip unknown-xref sekali jalan', async () => {
    const fake = makeFakeIO()
    const report = await applyImportPlan(
      plan(
        [member('I1', 'A')],
        [
          { memberXref: 'I8', relatedXref: 'I9', type: 'spouse' },
          { memberXref: 'I1', relatedXref: 'I2', type: 'parent' },
        ],
      ),
      fake.io,
    )
    expect(report.skippedRelations).toEqual([
      { memberXref: 'I8', relatedXref: 'I9', reason: 'unknown-xref' },
      { memberXref: 'I1', relatedXref: 'I2', reason: 'unknown-xref' },
    ])
    expect(report.createdRelations).toBe(0)
  })
})
