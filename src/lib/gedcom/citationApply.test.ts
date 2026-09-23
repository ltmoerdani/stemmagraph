// Test citationApply (v155-ii): adapter palsu in-memory tanpa DB nyata.
// Kasus: happy per eventKind, skip xref unknown/no-xref, idempoten Source,
// never throws adapter error, regresi perilaku lama (io tidak disediakan),
// dan urutan fase member lalu relations lalu citations.

import { describe, expect, it } from 'vitest'
import { applyImportPlan } from './applyImportPlan'
import type { ImportApplyIO } from './applyImportPlan'
import type { ImportPlan, PlannedMember } from './importPlan'
import { applyCitationPlan } from './citationApply'
import type { CitationApplyIO } from './citationApply'
import type { CitationPlanEntry } from './citationPlan'

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

/** Entry rencana sitasi minimal dengan nilai opsional eksplisit. */
function entry(partial: Partial<CitationPlanEntry> & {
  eventKind: CitationPlanEntry['eventKind']
  sourcePointer: string
}): CitationPlanEntry {
  return {
    memberId: undefined,
    relationId: undefined,
    page: undefined,
    quay: undefined,
    note: undefined,
    ...partial,
  }
}

/** Resolver dari map sederhana; bentuk wiring layer fase berikutnya. */
const memberMap = new Map([
  ['@I1@', 'db-m1'],
  ['@I2@', 'db-m2'],
  ['@I3@', 'db-m3'],
])
const famMap = new Map<string, [string, string]>([
  ['@F1@', ['db-m1', 'db-m2']],
])

const resolvers = {
  resolveMember: (xref: string) => memberMap.get(xref),
  resolveRelation: (xref: string) => famMap.get(xref),
}

interface SourceCall { treeId: string; pointer: string }
interface CitationCall {
  treeId: string
  spec: {
    sourceId: string
    sourcePointer: string
    page: string | undefined
    quay: string | undefined
    note: string | undefined
    eventType: 'BIRTH' | 'DEATH' | 'MARRIAGE' | 'DIVORCE'
    memberId: string
    partnerMemberId: string | undefined
  }
}

interface FakeCiteIO {
  io: CitationApplyIO | undefined
  /** Log gabungan fase: 'source:@S1@:src-1' lalu 'citation:@S1@:BIRTH:db-m1:cit-1'. */
  log: string[]
  sourceCalls: SourceCall[]
  citationCalls: CitationCall[]
}

/**
 * Adapter palsu: Source id 'src-N', Citation id 'cit-N'. Kegagalan dipicu
 * lewat daftar pointer source atau pointer+eventType sitasi.
 */
function makeFakeCiteIO(opts: {
  failSourcePointers?: string[]
  failCitationPointers?: string[]
  treeId?: string
} = {}): FakeCiteIO {
  const log: string[] = []
  const sourceCalls: SourceCall[] = []
  const citationCalls: CitationCall[] = []
  let seq = 0
  const io: CitationApplyIO = {
    treeId: opts.treeId ?? 'tree-1',
    async upsertSource(treeId, pointer) {
      sourceCalls.push({ treeId, pointer })
      if (opts.failSourcePointers?.includes(pointer)) {
        throw new Error(`boom-source:${pointer}`)
      }
      const id = `src-${++seq}`
      log.push(`source:${pointer}:${id}`)
      return id
    },
    async upsertCitation(treeId, spec) {
      citationCalls.push({ treeId, spec })
      if (opts.failCitationPointers?.includes(spec.sourcePointer)) {
        throw new Error(`boom-citation:${spec.sourcePointer}`)
      }
      const id = `cit-${++seq}`
      log.push(
        `citation:${spec.sourcePointer}:${spec.eventType}:${spec.memberId}${spec.partnerMemberId ? `+${spec.partnerMemberId}` : ''}:${id}`,
      )
      return id
    },
  }
  return { io, log, sourceCalls, citationCalls }
}

describe('applyCitationPlan', () => {
  it('happy BIRT: source dibuat, citation terikat member tunggal', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@S1@', page: 'p. 12', quay: '3', note: 'catatan' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.createdSources).toEqual([{ pointer: '@S1@', id: 'src-1' }])
    expect(report.createdCitations).toEqual([
      { xref: '@I1@', eventKind: 'BIRT', sourcePointer: '@S1@', citationId: 'cit-2' },
    ])
    expect(fake.citationCalls).toHaveLength(1)
    const spec = fake.citationCalls[0].spec
    expect(spec).toMatchObject({
      sourceId: 'src-1',
      eventType: 'BIRTH',
      memberId: 'db-m1',
      partnerMemberId: undefined,
      page: 'p. 12',
      quay: '3',
      note: 'catatan',
    })
    expect(report.skippedCitations).toEqual([])
    expect(report.failedSources).toEqual([])
    expect(report.failedCitations).toEqual([])
  })

  it('happy DEAT: eventType DEATH, member tunggal', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ memberId: '@I2@', eventKind: 'DEAT', sourcePointer: '@S2@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.createdCitations[0].citationId).toBe('cit-2')
    expect(fake.citationCalls[0].spec).toMatchObject({
      eventType: 'DEATH',
      memberId: 'db-m2',
      partnerMemberId: undefined,
    })
  })

  it('happy MARR: partnerMemberId terisi dari resolver FAM', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ relationId: '@F1@', eventKind: 'MARR', sourcePointer: '@S3@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(fake.citationCalls[0].spec).toMatchObject({
      eventType: 'MARRIAGE',
      memberId: 'db-m1',
      partnerMemberId: 'db-m2',
    })
    expect(report.createdCitations[0].xref).toBe('@F1@')
  })

  it('happy DIV: eventType DIVORCE dengan partner', async () => {
    const fake = makeFakeCiteIO()
    await applyCitationPlan(
      [entry({ relationId: '@F1@', eventKind: 'DIV', sourcePointer: '@S4@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(fake.citationCalls[0].spec).toMatchObject({
      eventType: 'DIVORCE',
      memberId: 'db-m1',
      partnerMemberId: 'db-m2',
    })
  })

  it('skip unknown member xref (BIRT), alasan unknown-xref, adapter tak dipanggil', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ memberId: '@I9@', eventKind: 'BIRT', sourcePointer: '@S1@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.skippedCitations).toEqual([
      { xref: '@I9@', eventKind: 'BIRT', sourcePointer: '@S1@', reason: 'unknown-xref' },
    ])
    expect(fake.sourceCalls).toHaveLength(0)
    expect(fake.citationCalls).toHaveLength(0)
  })

  it('skip unknown FAM xref (MARR), tanpa lempar', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ relationId: '@F9@', eventKind: 'MARR', sourcePointer: '@S1@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.skippedCitations).toEqual([
      { xref: '@F9@', eventKind: 'MARR', sourcePointer: '@S1@', reason: 'unknown-xref' },
    ])
    expect(fake.citationCalls).toHaveLength(0)
  })

  it('skip entry tanpa xref sama sekali, alasan no-xref', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [entry({ eventKind: 'BIRT', sourcePointer: '@S1@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.skippedCitations).toEqual([
      { xref: undefined, eventKind: 'BIRT', sourcePointer: '@S1@', reason: 'no-xref' },
    ])
    expect(fake.citationCalls).toHaveLength(0)
  })

  it('idempoten Source: pointer sama dua entry, upsertSource sekali, sitasi dua', async () => {
    const fake = makeFakeCiteIO()
    const report = await applyCitationPlan(
      [
        entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@S1@', page: 'p. 1' }),
        entry({ memberId: '@I2@', eventKind: 'DEAT', sourcePointer: '@S1@', page: 'p. 2' }),
      ],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(fake.sourceCalls).toHaveLength(1)
    expect(report.createdSources).toEqual([{ pointer: '@S1@', id: 'src-1' }])
    expect(report.createdCitations).toHaveLength(2)
    expect(fake.citationCalls[0].spec.sourceId).toBe('src-1')
    expect(fake.citationCalls[1].spec.sourceId).toBe('src-1')
  })

  it('never throws: upsertSource error tercatat, entry lanjut, tanpa lempar', async () => {
    const fake = makeFakeCiteIO({ failSourcePointers: ['@SBAD@'] })
    const report = await applyCitationPlan(
      [
        entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@SBAD@' }),
        entry({ memberId: '@I2@', eventKind: 'DEAT', sourcePointer: '@SOK@' }),
      ],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.failedSources).toEqual([
      { pointer: '@SBAD@', error: 'boom-source:@SBAD@' },
    ])
    expect(report.createdCitations.map((c) => c.sourcePointer)).toEqual(['@SOK@'])
    // Entry pertama tidak meninggalkan sitasi; entry kedua sukses.
    expect(report.skippedCitations).toEqual([])
  })

  it('never throws: upsertCitation error tercatat, entry lanjut', async () => {
    const fake = makeFakeCiteIO({ failCitationPointers: ['@SBAD@'] })
    const report = await applyCitationPlan(
      [
        entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@SBAD@' }),
        entry({ memberId: '@I2@', eventKind: 'DEAT', sourcePointer: '@SOK@' }),
      ],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      fake.io,
    )
    expect(report.failedCitations).toEqual([
      {
        sourcePointer: '@SBAD@',
        eventType: 'BIRTH',
        memberId: 'db-m1',
        error: 'boom-citation:@SBAD@',
      },
    ])
    expect(report.createdCitations.map((c) => c.sourcePointer)).toEqual(['@SOK@'])
  })

  it('regresi: io sitasi tidak disediakan, laporan kosong jujur, rantai lama tak berubah', async () => {
    // Perilaku lama: applyImportPlan berjalan normal tanpa io sitasi.
    const logMember: string[] = []
    const logRelation: string[] = []
    const planIo: ImportApplyIO = {
      treeId: 'tree-1',
      async createMember(input) {
        logMember.push(input.name ?? '')
        return `m-${input.name}`
      },
      async createRelation() {
        logRelation.push('rel')
      },
    }
    const applyReport = await applyImportPlan(
      plan([member('@I1@', 'A'), member('@I2@', 'B')], [
        { memberXref: '@I1@', relatedXref: '@I2@', type: 'spouse' },
      ]),
      planIo,
    )
    expect(applyReport.createdMembers).toHaveLength(2)
    expect(applyReport.createdRelations).toBe(1)

    const report = await applyCitationPlan(
      [entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@S1@' })],
      resolvers.resolveMember,
      resolvers.resolveRelation,
      undefined,
    )
    expect(report).toEqual({
      createdSources: [],
      createdCitations: [],
      skippedCitations: [],
      failedSources: [],
      failedCitations: [],
    })
  })

  it('urutan fase: member dulu, lalu relations, lalu citations (log gabungan)', async () => {
    const log: string[] = []
    const mem = new Map<string, string>()
    const fam = new Map<string, [string, string]>()

    const planIo: ImportApplyIO = {
      treeId: 'tree-1',
      async createMember(input) {
        const id = `m-${input.name}`
        log.push(`member:${id}`)
        return id
      },
      async createRelation(_treeId, memberId, relatedId, type) {
        log.push(`relation:${memberId}->${relatedId}:${type}`)
        if (!fam.has('@F1@')) fam.set('@F1@', [memberId, relatedId])
      },
    }
    const applyReport = await applyImportPlan(
      plan(
        [member('@I1@', 'A'), member('@I2@', 'B')],
        [{ memberXref: '@I1@', relatedXref: '@I2@', type: 'spouse' }],
      ),
      planIo,
    )
    for (const cm of applyReport.createdMembers) {
      if (cm.xref !== undefined) mem.set(cm.xref, cm.id)
    }

    const fake = makeFakeCiteIO()
    const entries = [
      entry({ relationId: '@F1@', eventKind: 'MARR', sourcePointer: '@S1@' }),
      entry({ memberId: '@I1@', eventKind: 'BIRT', sourcePointer: '@S1@' }),
    ]
    const report = await applyCitationPlan(
      entries,
      (xref) => mem.get(xref),
      (xref) => fam.get(xref),
      fake.io,
    )
    expect(applyReport.createdMembers).toHaveLength(2)
    expect(report.createdCitations).toHaveLength(2)
    // Source idempoten lintas entry dalam satu run.
    expect(fake.sourceCalls).toHaveLength(1)
    // Seluruh log fase 1-2 mendahului log fase sitasi.
    const combined = [...log, ...fake.log]
    const relationIdx = combined.findIndex((l) => l.startsWith('relation:'))
    const sourceIdx = combined.findIndex((l) => l.startsWith('source:'))
    const citationIdx = combined.findIndex((l) => l.startsWith('citation:'))
    expect(relationIdx).toBeGreaterThan(-1)
    expect(sourceIdx).toBeGreaterThan(relationIdx)
    expect(citationIdx).toBeGreaterThan(sourceIdx)
  })
})
