// Tests PEDI export wiring (v159-iv): famPedi pada ExportGedcom70Input
// ditulis sebagai sub PEDI verbatim di bawah FAMC pada INDI (bukan CHIL;
// per spec GEDCOM 7 PEDI hanya punya superstructure INDI-FAMC, CHIL hanya
// mengizinkan PHRASE). Key input: famXref F1 F2 dst sama dengan pointer
// FAMC. Cakupan: enum verbatim, phrase, byte-identity, keying per
// pointer, dan ketahanan parse import.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import { importFamilies } from './importFamilies'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

const EXPORTED_AT = new Date('2026-09-25T00:00:00Z')

function member(
  partial: Partial<FamilyMemberRecord> & Pick<FamilyMemberRecord, 'id'>,
): FamilyMemberRecord {
  return {
    treeId: 'tree-1',
    name: `Nama ${partial.id}`,
    birthDate: '1 JAN 1990',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...partial,
  }
}

function rel(
  id: string,
  memberId: string,
  relatedId: string,
  type: MemberRelationship['type'],
): MemberRelationship {
  return { id, memberId, relatedId, type }
}

/** Keluarga couple a+b dengan anak c (jadi F1, anak c = I3). */
function familyOfChild(): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return {
    members: [
      member({ id: 'a' }),
      member({ id: 'b', gender: 'female' }),
      member({ id: 'c' }),
    ],
    relationships: [
      rel('r1', 'a', 'b', 'spouse'),
      rel('r2', 'a', 'c', 'parent'),
      rel('r3', 'b', 'c', 'parent'),
    ],
  }
}

/** Keluarga single parent d dengan anak yang sama c (jadi F2). */
function singleParentFamily(): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return {
    members: [member({ id: 'd' }), member({ id: 'c' })],
    relationships: [rel('r4', 'd', 'c', 'parent')],
  }
}

function blockOf(gedcom: string, tag: string, xref: string): string[] {
  const lines = gedcom.split('\n')
  const start = lines.findIndex((l) => l === `0 @${xref}@ ${tag}`)
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && l.startsWith('0 '))
  return lines.slice(start, end === -1 ? lines.length : end)
}

function indiBlockOf(gedcom: string, xref: string): string[] {
  return blockOf(gedcom, 'INDI', xref)
}

describe('exportGedcom70 PEDI wiring (v159-iv)', () => {
  it('t1: PEDI BIRTH ditulis verbatim di bawah FAMC pada INDI anak', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'BIRTH' },
    })
    const indi = indiBlockOf(gedcom, 'I3')
    expect(indi).toContain('1 FAMC @F1@')
    expect(indi).toContain('2 PEDI BIRTH')
    // CHIL di FAM tidak membawa PEDI (spec: CHIL hanya PHRASE).
    const fam = blockOf(gedcom, 'FAM', 'F1')
    expect(fam.join('\n')).not.toMatch(/PEDI/)
  })

  it('t2: famPedi absent, kosong, atau tanpa key cocok = byte-identical', () => {
    const base = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
    }).gedcom
    const empty = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: {},
    }).gedcom
    const noMatch = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F9:zz': 'BIRTH' },
    }).gedcom
    expect(empty).toBe(base)
    expect(noMatch).toBe(base)
  })

  it('t3: anak dua keluarga, PEDI berbeda per pointer FAMC', () => {
    const { members: m1, relationships: r1 } = familyOfChild()
    const { relationships: r2 } = singleParentFamily()
    const { gedcom } = exportGedcom70({
      members: [...m1, member({ id: 'd' })],
      relationships: [...r1, ...r2],
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'BIRTH', 'F2:c': 'ADOPTED' },
    })
    const indi = indiBlockOf(gedcom, 'I3')
    const idxF1 = indi.findIndex((l) => l === '1 FAMC @F1@')
    expect(idxF1).toBeGreaterThan(-1)
    expect(indi[idxF1 + 1]).toBe('2 PEDI BIRTH')
    const idxF2 = indi.findIndex((l) => l === '1 FAMC @F2@')
    expect(idxF2).toBeGreaterThan(-1)
    expect(indi[idxF2 + 1]).toBe('2 PEDI ADOPTED')
  })

  it('t4: enum FOSTER ditulis verbatim tanpa normalisasi', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'FOSTER' },
    })
    expect(indiBlockOf(gedcom, 'I3')).toContain('2 PEDI FOSTER')
  })

  it('t5: nilai tak dikenal ditulis raw verbatim tanpa sharpening', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'RADA' },
    })
    expect(indiBlockOf(gedcom, 'I3')).toContain('2 PEDI RADA')
  })

  it('t6: payload kosong nihil emit (byte-identical vs baseline)', () => {
    const base = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
    }).gedcom
    const withEmpty = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': '' },
    }).gedcom
    expect(withEmpty).toBe(base)
  })

  it('t7: key milik member lain tidak membocorkan PEDI ke anak lain', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:a': 'BIRTH' },
    })
    const indiC = indiBlockOf(gedcom, 'I3').join('\n')
    expect(indiC).toContain('1 FAMC @F1@')
    expect(indiC).not.toMatch(/PEDI/)
  })

  it('t8: single-parent family, PEDI ditulis di FAMC anak', () => {
    const { gedcom } = exportGedcom70({
      ...singleParentFamily(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'SEALING' },
    })
    // Single parent: keluarga d+c menjadi F1 (satu-satunya FAM).
    // Sort id: c = I1 (anak, pemilik FAMC), d = I2 (orang tua, FAMS).
    expect(indiBlockOf(gedcom, 'I1')).toContain('2 PEDI SEALING')
    // Orang tua tidak membawa PEDI (spec: PEDI hanya di INDI-FAMC).
    expect(indiBlockOf(gedcom, 'I2').join('\n')).not.toMatch(/PEDI/)
  })

  it('t9: komposisi famcStat tidak terganggu, STAT lalu PEDI berurutan', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famcStat: { c: 'CHALLENGED' },
      famPedi: { 'F1:c': 'BIRTH' },
    })
    const indi = indiBlockOf(gedcom, 'I3')
    const idxF1 = indi.findIndex((l) => l === '1 FAMC @F1@')
    expect(indi[idxF1 + 1]).toBe('2 STAT CHALLENGED')
    expect(indi[idxF1 + 2]).toBe('2 PEDI BIRTH')
  })

  it('t10: GEDCOM hasil export tetap ter-import, anak tetap terbaca', () => {
    const { gedcom } = exportGedcom70({
      ...familyOfChild(),
      exportedAt: EXPORTED_AT,
      famPedi: { 'F1:c': 'ADOPTED' },
    })
    const fams = importFamilies(gedcom)
    expect(fams).toHaveLength(1)
    expect(fams[0].children).toContain('I3')
    // Import sisi FAM tidak membaca PEDI dari CHIL (bukan posisi spec);
    // konsumsi PEDI level INDI-FAMC adalah item koreksi import terpisah.
    expect(fams[0].childLinks).toHaveLength(0)
  })
})
