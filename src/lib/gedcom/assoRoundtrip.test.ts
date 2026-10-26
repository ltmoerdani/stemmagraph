// Test ASSO asosiasi antar individu fase 1 (v405):
// (1) enum ROLE 15 nilai via resolveAssoRole (case-sensitive, unknown);
// (2) capture import ASSO level record (WITN/FRIEND/MULTIPLE, OTHER +
// PHRASE, @VOID@ + PHRASE utuh, ASSO tanpa ROLE di-skip jujur);
// (3) export emit ASSO verbatim + backward compat byte-identik;
// (4) round-trip export -> import utuh;
// (5) wiring importPlan dan applyImportPlan meneruskan associations.

import { describe, expect, it } from 'vitest'
import { ASSO_ROLE_VALUES, resolveAssoRole } from './assoRole'
import type { ParsedAssociation } from './assoRole'
import { importIndividuals } from './importIndividuals'
import { exportGedcom70 } from './exportGedcom70'
import { buildImportPlan } from './importPlan'
import { applyImportPlan } from './applyImportPlan'
import type { CreateMemberInput } from './applyImportPlan'
import type { FamilyMemberRecord } from '../adapters/types'

const EXPORTED_AT = new Date('2026-10-26T00:00:00Z')

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

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0']

function gedcomOf(lines: string[]): string {
  return [...HEAD, ...lines].join('\n')
}

describe('assoRole enum', () => {
  it('mempunyai tepat 15 nilai enumset-ROLE', () => {
    expect(ASSO_ROLE_VALUES).toHaveLength(15)
    expect([...ASSO_ROLE_VALUES].sort()).toEqual(
      [
        'CHIL', 'CLERGY', 'FATH', 'FRIEND', 'GODP', 'HUSB', 'MOTH',
        'MULTIPLE', 'NGHBR', 'OFFICIATOR', 'PARENT', 'SPOU', 'WIFE',
        'WITN', 'OTHER',
      ].sort(),
    )
  })

  it('resolusi case-sensitive tanpa normalisasi', () => {
    expect(resolveAssoRole('WITN').known).toBe(true)
    expect(resolveAssoRole('WITN').value).toBe('WITN')
    expect(resolveAssoRole('witn').known).toBe(false)
    expect(resolveAssoRole('witn').value).toBeNull()
    expect(resolveAssoRole('witn').raw).toBe('witn')
  })

  it('nilai unknown berakhir di phrase/raw tanpa dipetakan', () => {
    const r = resolveAssoRole('MENTOR')
    expect(r.known).toBe(false)
    expect(r.value).toBeNull()
    expect(r.phrase).toBe('MENTOR')
    expect(r.raw).toBe('MENTOR')
  })
})

describe('asso export emit + backward compat', () => {
  it('member tanpa associations tidak menghasilkan baris ASSO', () => {
    const gedcom = exportGedcom70({
      members: [makeMember()],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    expect(gedcom).not.toContain('ASSO')
  })

  it('emit 1 ASSO @xref@ + 2 ROLE verbatim + 3 PHRASE dan 1 ASSO @VOID@', () => {
    const gedcom = exportGedcom70({
      members: [
        makeMember({
          id: 'm1',
          associations: [
            { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
            { xref: null, role: 'OTHER', roleResolved: resolveAssoRole('OTHER'), phrase: 'Mr Stockdale' },
          ] as unknown as Array<Record<string, never>>,
        }),
        makeMember({ id: 'm2', name: 'Siti', gender: 'female' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    }).gedcom
    const lines = gedcom.split('\n')
    expect(lines.filter((l) => l === '1 ASSO @I2@')).toHaveLength(1)
    expect(lines).toContain('2 ROLE WITN')
    expect(lines).toContain('1 ASSO @VOID@')
    expect(lines).toContain('2 ROLE OTHER')
    expect(lines).toContain('3 PHRASE Mr Stockdale')
  })

  it('ASSO di-skip untuk member redacted (PHRASE bisa membawa nama)', () => {
    const gedcom = exportGedcom70({
      members: [
        makeMember({
          id: 'm1',
          isAlive: true,
          privacyStatus: undefined,
          associations: [
            { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
          ] as unknown as Array<Record<string, never>>,
        }),
      ],
      relationships: [],
      privacyMode: 'clean',
      exportedAt: EXPORTED_AT,
    })
    expect(gedcom).not.toContain('ASSO')
  })

  it('ASSO tanpa role string kosong di-skip jujur saat export', () => {
    const gedcom = exportGedcom70({
      members: [
        makeMember({
          id: 'm1',
          associations: [
            { xref: 'I2', role: '', roleResolved: resolveAssoRole('') },
          ] as unknown as Array<Record<string, never>>,
        }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    expect(gedcom).not.toContain('ASSO')
  })
})

describe('asso round-trip export -> import', () => {
  it('WITN FRIEND MULTIPLE OTHER+PHRASE VOID+PHRASE utuh keluar masuk', () => {
    const asso: ParsedAssociation[] = [
      { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
      { xref: 'I3', role: 'FRIEND', roleResolved: resolveAssoRole('FRIEND') },
      { xref: 'I4', role: 'MULTIPLE', roleResolved: resolveAssoRole('MULTIPLE'), phrase: 'twin brother' },
      { xref: null, role: 'OTHER', roleResolved: resolveAssoRole('OTHER'), phrase: 'Mr Stockdale' },
    ]
    const exported = exportGedcom70({
      members: [
        makeMember({ id: 'm1', associations: asso as unknown as Array<Record<string, never>> }),
        makeMember({ id: 'm2', name: 'Siti', gender: 'female' }),
        makeMember({ id: 'm3', name: 'Andi' }),
        makeMember({ id: 'm4', name: 'Ayu', gender: 'female' }),
      ],
      relationships: [
        { id: 'r1', treeId: 'tree-1', memberId: 'm1', relatedId: 'm2', type: 'spouse' },
      ],
      exportedAt: EXPORTED_AT,
    }).gedcom
    const parsed = importIndividuals(exported)
    const first = parsed.find((p) => p.xref === 'I1')
    expect(first?.associations).toHaveLength(4)
    expect(first?.associations?.[0]).toMatchObject({ xref: 'I2', role: 'WITN' })
    expect(first?.associations?.[0].roleResolved.known).toBe(true)
    expect(first?.associations?.[1]).toMatchObject({ xref: 'I3', role: 'FRIEND' })
    expect(first?.associations?.[2]).toMatchObject({ xref: 'I4', role: 'MULTIPLE', phrase: 'twin brother' })
    expect(first?.associations?.[3]).toMatchObject({ xref: null, role: 'OTHER', phrase: 'Mr Stockdale' })
    // Member lain tanpa ASSO: field absen, bukan array kosong.
    const second = parsed.find((p) => p.xref === 'I2')
    expect(second?.associations).toBeUndefined()
  })

  it('ASSO tanpa ROLE di import di-skip dengan log jujur, tanpa throw', () => {
    const gedcom = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME A',
      '1 ASSO @I2@',
      '0 @I2@ INDI',
      '1 NAME B',
    ])
    const logs: string[] = []
    const out = importIndividuals(gedcom, (m) => logs.push(m))
    expect(out).toHaveLength(2)
    const first = out.find((p) => p.xref === 'I1')
    expect(first?.associations).toBeUndefined()
    expect(logs.join(' ')).toContain('ASSO without ROLE skipped')
  })
})

describe('asso wiring importPlan + applyImportPlan', () => {
  it('buildImportPlan meneruskan associations ke PlannedMember', () => {
    const assoc: ParsedAssociation[] = [
      { xref: 'I2', role: 'GODP', roleResolved: resolveAssoRole('GODP') },
    ]
    const plan = buildImportPlan(
      [
        {
          xref: 'I1',
          name: 'A',
          sex: undefined,
          birthDate: undefined,
          birthPlace: undefined,
          deathDate: undefined,
          deathPlace: 'X',
          resn: undefined,
          noAssertions: [],
          citations: [],
          associations: assoc,
        },
      ],
      [],
    )
    expect(plan.members).toHaveLength(1)
    expect(plan.members[0].associations).toEqual(assoc)
  })

  it('member nihil ASSO: associations undefined di plan (tanpa array kosong)', () => {
    const plan = buildImportPlan(
      [
        {
          xref: 'I1',
          name: 'A',
          sex: undefined,
          birthDate: undefined,
          birthPlace: undefined,
          deathDate: undefined,
          deathPlace: 'X',
          resn: undefined,
          noAssertions: [],
          citations: [],
        },
      ],
      [],
    )
    expect(plan.members[0].associations).toBeUndefined()
  })

  it('applyImportPlan meneruskan associations ke createMember input', async () => {
    const assoc: ParsedAssociation[] = [
      { xref: 'I2', role: 'WITN', roleResolved: resolveAssoRole('WITN') },
    ]
    const created: CreateMemberInput[] = []
    await applyImportPlan(
      {
        members: [
          {
            xref: 'I1',
            name: 'A',
            gender: 'other',
            birthDate: undefined,
            birthPlace: undefined,
            deathDate: undefined,
            deathPlace: undefined,
            associations: assoc,
          },
        ],
        relationships: [],
        skipped: [],
      },
      {
        treeId: 't1',
        createMember: async (input) => {
          created.push(input)
          return 'new-id-1'
        },
        createRelation: async () => undefined,
      },
    )
    expect(created).toHaveLength(1)
    expect(created[0].associations).toEqual(assoc)
  })
})
