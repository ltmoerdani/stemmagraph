// Test wiring ASSO apply adapter (v466): createPrismaApplyAdapter menulis
// associations hasil capture import ke kolom Json FamilyMember lewat
// TransactionClient palsu in-memory, tanpa database nyata. Alurnya
// mengikuti pemakaian nyata: teks GEDCOM di-parse importIndividuals,
// direncanakan buildImportPlan, lalu diterapkan applyImportPlan dengan
// io dari adapter. Nilai yang tertangkap dibandingkan utuh dan di-emit
// ulang lewat exportGedcom70 untuk pembuktian dua arah.
//
// Semantik kolom (schema FamilyMember.associations Json?, v405):
// NULL untuk INDI tanpa ASSO sah, array ParsedAssociation verbatim
// untuk INDI ber-ASSO ber-ROLE (xref null = @VOID@, role case-sensitive).

import { describe, expect, it } from 'vitest'
import type { Prisma } from '../../generated/prisma/client'
import { createPrismaApplyAdapter } from './applyAdapter'
import { applyImportPlan } from './applyImportPlan'
import type { ImportApplyReport } from './applyImportPlan'
import { buildImportPlan } from './importPlan'
import { importIndividuals } from './importIndividuals'
import { exportGedcom70 } from './exportGedcom70'
import { resolveAssoRole } from './assoRole'
import type { ParsedAssociation } from './assoRole'
import type { FamilyMemberRecord } from '../adapters/types'

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0']
const EXPORTED_AT = new Date('2026-11-26T00:00:00Z')

function gedcomOf(lines: string[]): string {
  return [...HEAD, ...lines].join('\n')
}

/** Data create member yang tertangkap mock, bentuk apa adanya. */
interface CapturedMemberData {
  treeId: string
  associations: unknown
  [key: string]: unknown
}

/**
 * TransactionClient palsu: create member dan relation hanya mencatat
 * argumen lalu mengembalikan id berurutan; tidak ada database nyata.
 */
function makeFakeTx(
  captured: CapturedMemberData[],
  relations: Record<string, string>[],
): Prisma.TransactionClient {
  return {
    familyMember: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.push(data as CapturedMemberData)
        return { id: `mem-${captured.length}` }
      },
    },
    familyRelationship: {
      create: async ({ data }: { data: Record<string, string> }) => {
        relations.push(data)
        return { id: `rel-${relations.length}` }
      },
    },
  } as unknown as Prisma.TransactionClient
}

/**
 * Menjalankan alur import penuh sampai adapter Prisma; mengembalikan
 * data yang tertangkap beserta laporan applyImportPlan.
 */
async function applyGedcom(gedcom: string): Promise<{
  captured: CapturedMemberData[]
  relations: Record<string, string>[]
  report: ImportApplyReport
}> {
  const captured: CapturedMemberData[] = []
  const relations: Record<string, string>[] = []
  const io = createPrismaApplyAdapter(makeFakeTx(captured, relations), 'tree-466')
  const plan = buildImportPlan(importIndividuals(gedcom), [])
  const report = await applyImportPlan(plan, io)
  return { captured, relations, report }
}

function makeMember(
  overrides: Partial<FamilyMemberRecord> = {},
): FamilyMemberRecord {
  return {
    id: 'm1',
    treeId: 'tree-1',
    name: 'Budi Santoso',
    birthDate: '1 JAN 1970',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...overrides,
  }
}

describe('applyAdapter ASSO wiring (v466)', () => {
  it('apply sukses menulis associations utuh ke data create', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 ASSO @I2@',
      '2 ROLE WITN',
      '1 ASSO @I3@',
      '2 ROLE FRIEND',
      '1 ASSO @I4@',
      '2 ROLE MULTIPLE',
      '3 PHRASE twin brother',
      '1 ASSO @VOID@',
      '2 ROLE OTHER',
      '3 PHRASE Mr Stockdale',
      '0 @I2@ INDI',
      '1 NAME B',
      '0 @I3@ INDI',
      '1 NAME C',
      '0 @I4@ INDI',
      '1 NAME D',
    ])
    const { captured, report } = await applyGedcom(gedcom)
    expect(report.failedMembers).toHaveLength(0)
    expect(captured).toHaveLength(4)
    expect(captured[0].treeId).toBe('tree-466')
    const expected: ParsedAssociation[] = [
      { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
      { xref: 'I3', role: 'FRIEND', roleResolved: resolveAssoRole('FRIEND') },
      {
        xref: 'I4',
        role: 'MULTIPLE',
        roleResolved: resolveAssoRole('MULTIPLE'),
        phrase: 'twin brother',
      },
      {
        xref: null,
        role: 'OTHER',
        roleResolved: resolveAssoRole('OTHER'),
        phrase: 'Mr Stockdale',
      },
    ]
    expect(captured[0].associations).toEqual(expected)
  })

  it('ASSO VOID + PHRASE round trip utuh lewat kolom associations', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 ASSO @VOID@',
      '2 ROLE OTHER',
      '3 PHRASE Mr Stockdale',
      '0 @I2@ INDI',
      '1 NAME B',
    ])
    const { captured } = await applyGedcom(gedcom)
    expect(captured[0].associations).toEqual([
      {
        xref: null,
        role: 'OTHER',
        roleResolved: resolveAssoRole('OTHER'),
        phrase: 'Mr Stockdale',
      },
    ])
    // Nilai kolom di-emit ulang: VOID tetap VOID, PHRASE tetap utuh,
    // lalu masuk kembali identik saat re-import.
    const exported = exportGedcom70({
      members: [
        makeMember({
          id: 'm1',
          associations: captured[0].associations as unknown as Array<
            Record<string, never>
          >,
        }),
        makeMember({ id: 'm2', name: 'B' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    }).gedcom
    const lines = exported.split('\n')
    expect(lines).toContain('1 ASSO @VOID@')
    expect(lines).toContain('2 ROLE OTHER')
    expect(lines).toContain('3 PHRASE Mr Stockdale')
    const reparsed = importIndividuals(exported)
    expect(reparsed.find((p) => p.xref === 'I1')?.associations).toEqual(
      captured[0].associations,
    )
  })

  it('ASSO level record setelah event tetap tercatat di INDI yang sama', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 BIRT',
      '2 DATE 1 JAN 1970',
      '1 ASSO @I2@',
      '2 ROLE WITN',
      '0 @I2@ INDI',
      '1 NAME B',
    ])
    const { captured } = await applyGedcom(gedcom)
    expect(captured[0].associations).toEqual([
      { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
    ])
  })

  it('ASSO subordinate ke event tidak terangkat ke kolom associations member', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 BIRT',
      '2 DATE 1 JAN 1970',
      '2 ASSO @I2@',
      '3 ROLE WITN',
      '0 @I2@ INDI',
      '1 NAME B',
    ])
    const { captured } = await applyGedcom(gedcom)
    // ASSO tingkat event bukan milik kolom record: ia tetap di event,
    // kolom associations member tetap NULL (undefined di data create).
    expect(captured[0].associations).toBeUndefined()
  })

  it('ASSO + ROLE enum dua arah: import lalu export identik', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 ASSO @I2@',
      '2 ROLE WITN',
      '1 ASSO @I3@',
      '2 ROLE GODP',
      '0 @I2@ INDI',
      '1 NAME B',
      '0 @I3@ INDI',
      '1 NAME C',
    ])
    const { captured } = await applyGedcom(gedcom)
    const asso = captured[0].associations as ParsedAssociation[]
    expect(asso.map((a) => a.role)).toEqual(['WITN', 'GODP'])
    const exported = exportGedcom70({
      members: [
        makeMember({
          id: 'm1',
          associations: asso as unknown as Array<Record<string, never>>,
        }),
        makeMember({ id: 'm2', name: 'B' }),
        makeMember({ id: 'm3', name: 'C', gender: 'female' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    }).gedcom
    const lines = exported.split('\n')
    expect(lines.filter((l) => l === '1 ASSO @I2@')).toHaveLength(1)
    expect(lines.filter((l) => l === '1 ASSO @I3@')).toHaveLength(1)
    expect(lines).toContain('2 ROLE WITN')
    expect(lines).toContain('2 ROLE GODP')
    const reparsed = importIndividuals(exported)
    expect(reparsed.find((p) => p.xref === 'I1')?.associations).toEqual(asso)
  })

  it('INDI tanpa ASSO: associations tetap NULL, sesama INDI ber-ASSO tetap tertulis', async () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '0 @I2@ INDI',
      '1 NAME B',
      '1 ASSO @I1@',
      '2 ROLE FRIEND',
    ])
    const { captured } = await applyGedcom(gedcom)
    expect(captured).toHaveLength(2)
    expect(captured[0].associations).toBeUndefined()
    expect(captured[1].associations).toEqual([
      { xref: 'I1', role: 'FRIEND', roleResolved: resolveAssoRole('FRIEND') },
    ])
  })
})
