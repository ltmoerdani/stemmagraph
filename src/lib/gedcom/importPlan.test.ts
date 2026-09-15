// Test buildImportPlan (S1F6-A): kasus inti perencanaan member dan relasi
// dari hasil importIndividuals + importFamilies, termasuk SATU round-trip
// nyata export lalu import lalu plan. Kasus sanitasi tanggal/place sudah
// dipegang parseEventDate.test.ts dan placePayload.test.ts; di sini cukup
// wiring level lib.

import { describe, expect, it } from 'vitest'
import { buildImportPlan } from './importPlan'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord, MemberRelationship } from '../adapters/types'

describe('buildImportPlan', () => {
  it('maps gender M, F, and other to male/female/other without guessing', () => {
    const individuals = [
      { xref: 'I1', name: 'A', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I2', name: 'B', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I3', name: 'C', sex: 'X', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I4', name: 'D', sex: undefined, birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const plan = buildImportPlan(individuals, [])
    expect(plan.members.map((m) => m.gender)).toEqual(['male', 'female', 'other', 'other'])
    expect(plan.relationships).toEqual([])
    expect(plan.skipped).toEqual([])
  })

  it('keeps member fields lossless, including ParsedEventDate identity', () => {
    const birth = { dateKind: 'EXACT' as const, year: 1900, month: 1, day: 12, originalDateString: '12 JAN 1900' }
    const death = { dateKind: 'ABOUT' as const, year: 1970, originalDateString: 'ABT 1970' }
    const individuals = [
      {
        xref: 'I1',
        name: 'Budi Santoso',
        sex: 'M',
        birthDate: birth,
        birthPlace: 'Surabaya, Jawa Timur',
        deathDate: death,
        deathPlace: undefined,
      },
    ]
    const plan = buildImportPlan(individuals, [])
    expect(plan.members).toHaveLength(1)
    const m = plan.members[0]
    expect(m.xref).toBe('I1')
    expect(m.name).toBe('Budi Santoso')
    expect(m.birthDate).toBe(birth)
    expect(m.deathDate).toBe(death)
    expect(m.birthPlace).toBe('Surabaya, Jawa Timur')
    expect(m.deathPlace).toBeUndefined()
    // Tidak ada fabrikasi field wiring layer.
    expect('treeId' in m).toBe(false)
    expect('id' in m).toBe(false)
    expect('generation' in m).toBe(false)
    expect('maritalStatus' in m).toBe(false)
  })

  it('creates one spouse edge and parent edges to each child per parent', () => {
    const individuals = [
      { xref: 'I1', name: 'Ayah', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I2', name: 'Ibu', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I3', name: 'Anak', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I4', name: 'Anak2', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      { xref: 'F1', husband: 'I1', wife: 'I2', children: ['I3', 'I4'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([
      { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
      { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
      { memberXref: 'I2', relatedXref: 'I3', type: 'parent' },
      { memberXref: 'I1', relatedXref: 'I4', type: 'parent' },
      { memberXref: 'I2', relatedXref: 'I4', type: 'parent' },
    ])
    expect(plan.skipped).toEqual([])
  })

  it('dedupes identical (memberXref, relatedXref, type) triples', () => {
    const individuals = [
      { xref: 'I1', name: 'A', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I2', name: 'B', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I3', name: 'C', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      { xref: 'F1', husband: 'I1', wife: 'I2', children: ['I3'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
      { xref: 'F2', husband: 'I1', wife: 'I2', children: ['I3'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([
      { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
      { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
      { memberXref: 'I2', relatedXref: 'I3', type: 'parent' },
    ])
  })

  it('skips unknown-xref families and drops relations touching that xref', () => {
    const individuals = [
      { xref: 'I1', name: 'Ayah', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I2', name: 'Ibu', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I3', name: 'Anak', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      // HUSB tak dikenal: relasi suami dan parent dari suami hilang;
      // relasi yang hanya menyentuh member sah tetap dibuat.
      { xref: 'F1', husband: 'IX', wife: 'I2', children: ['I3'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
      // Anak tak dikenal: hanya edge parent ke anak itu yang hilang.
      { xref: 'F2', husband: 'I1', wife: 'I2', children: ['IY'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([
      { memberXref: 'I2', relatedXref: 'I3', type: 'parent' },
      { memberXref: 'I1', relatedXref: 'I2', type: 'spouse' },
    ])
    expect(plan.skipped).toEqual([
      { source: 'FAM', xref: 'F1', reason: 'unknown-xref' },
      { source: 'FAM', xref: 'F2', reason: 'unknown-xref' },
    ])
    // Tidak ada member placeholder untuk IX/IY.
    expect(plan.members.map((m) => m.xref)).toEqual(['I1', 'I2', 'I3'])
  })

  it('records a FAM without any parents as skipped when it has no valid member', () => {
    const individuals = [
      { xref: 'I1', name: 'A', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      { xref: 'F1', husband: undefined, wife: undefined, children: [], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([])
    expect(plan.skipped).toEqual([{ source: 'FAM', xref: 'F1', reason: 'no-valid-member' }])
  })

  it('records a fully unknown FAM as unknown-xref even with zero valid members', () => {
    const families = [
      { xref: 'F9', husband: 'X1', wife: 'X2', children: ['X3'], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan([], families)
    expect(plan.members).toEqual([])
    expect(plan.relationships).toEqual([])
    expect(plan.skipped).toEqual([{ source: 'FAM', xref: 'F9', reason: 'unknown-xref' }])
  })

  it('returns empty plan for empty input and never throws on null-ish arrays', () => {
    expect(buildImportPlan([], [])).toEqual({ members: [], relationships: [], skipped: [] })
    // Never throws: pemanggilan dua kali dengan array kosong konsisten.
    expect(buildImportPlan([], []).members).toHaveLength(0)
  })

  it('does not create spouse edge when only one partner is known', () => {
    const individuals = [
      { xref: 'I1', name: 'A', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      { xref: 'F1', husband: 'I1', wife: 'GX', children: [], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([])
    expect(plan.skipped).toEqual([{ source: 'FAM', xref: 'F1', reason: 'unknown-xref' }])
  })

  it('emits spouse edge once even when both directions appear across FAMs', () => {
    // Dedupe berlaku juga untuk pasangan yang sama dari FAM berbeda.
    const individuals = [
      { xref: 'I1', name: 'A', sex: 'M', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
      { xref: 'I2', name: 'B', sex: 'F', birthDate: undefined, birthPlace: undefined, deathDate: undefined, deathPlace: undefined },
    ]
    const families = [
      { xref: 'F1', husband: 'I1', wife: 'I2', children: [], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
      { xref: 'F2', husband: 'I1', wife: 'I2', children: [], marriageDate: undefined, marriagePlace: undefined, divorceDate: undefined },
    ]
    const plan = buildImportPlan(individuals, families)
    expect(plan.relationships).toEqual([{ memberXref: 'I1', relatedXref: 'I2', type: 'spouse' }])
    // Kedua FAM sah: tidak ada skip.
    expect(plan.skipped).toEqual([])
  })

  it('round-trip: members + relationships -> export -> import -> plan is equivalent', () => {
    const member = (
      partial: Partial<FamilyMemberRecord> & Pick<FamilyMemberRecord, 'id' | 'name' | 'gender'>,
    ): FamilyMemberRecord => ({
      treeId: 'tree-1',
      birthDate: '1 JAN 1970',
      isAlive: true,
      generation: 1,
      maritalStatus: 'single',
      ...partial,
    })
    const members = [
      member({ id: 'a', name: 'Ayah', gender: 'male' }),
      member({ id: 'b', name: 'Ibu', gender: 'female' }),
      member({ id: 'c', name: 'Anak', gender: 'male' }),
    ]
    const relationships: MemberRelationship[] = [
      { id: 'r1', treeId: 'tree-1', memberId: 'a', relatedId: 'b', type: 'spouse' },
      { id: 'r2', treeId: 'tree-1', memberId: 'a', relatedId: 'c', type: 'parent' },
      { id: 'r3', treeId: 'tree-1', memberId: 'b', relatedId: 'c', type: 'parent' },
    ]

    const { gedcom } = exportGedcom70({
      members,
      relationships,
      exportedAt: new Date('2026-09-14T00:00:00Z'),
    })

    const individuals = importIndividuals(gedcom)
    const families = importFamilies(gedcom)
    const plan = buildImportPlan(individuals, families)

    // Tiga member, nama dan gender ekuivalen dengan input.
    expect(plan.members).toHaveLength(3)
    const byXref = new Map(plan.members.map((m) => [m.xref, m]))
    expect(byXref.get('I1')?.name).toBe('Ayah')
    expect(byXref.get('I1')?.gender).toBe('male')
    expect(byXref.get('I2')?.name).toBe('Ibu')
    expect(byXref.get('I2')?.gender).toBe('female')
    expect(byXref.get('I3')?.name).toBe('Anak')
    expect(byXref.get('I3')?.gender).toBe('male')

    // Spouse simetris: satu edge spouse antara I1 dan I2.
    const spouseEdges = plan.relationships.filter((r) => r.type === 'spouse')
    expect(spouseEdges).toEqual([{ memberXref: 'I1', relatedXref: 'I2', type: 'spouse' }])

    // Arah parent: I1 dan I2 masing-masing parent dari I3.
    const parentEdges = plan.relationships.filter((r) => r.type === 'parent')
    expect(parentEdges).toEqual([
      { memberXref: 'I1', relatedXref: 'I3', type: 'parent' },
      { memberXref: 'I2', relatedXref: 'I3', type: 'parent' },
    ])

    expect(plan.skipped).toEqual([])
  })
})
