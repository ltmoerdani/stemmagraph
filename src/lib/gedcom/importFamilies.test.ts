// Test importFamilies (S1F5-B): 12 kasus inti urai FAM, termasuk
// round-trip nyata exportGedcom70 lalu importFamilies. Kasus sanitasi
// tanggal/place detail sudah diuji di parseEventDate.test.ts dan
// placePayload.test.ts; di sini cukup wiring level lib.

import { describe, expect, it } from 'vitest'
import { importFamilies } from './importFamilies'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord, MemberRelationship } from '../adapters/types'

const EXPORTED_AT = new Date('2026-09-14T00:00:00Z')

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

describe('importFamilies', () => {
  it('parses one FAM with HUSB, WIFE, CHIL array, MARR DATE/PLAC, DIV DATE', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @I3@ INDI',
      '0 @I4@ INDI',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '1 CHIL @I4@',
      '1 MARR',
      '2 DATE 12 JAN 1900',
      '2 PLAC Surabaya, Jawa Timur',
      '1 DIV',
      '2 DATE BET 1970 AND 1980',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out).toHaveLength(1)
    const f = out[0]
    expect(f.xref).toBe('F1')
    expect(f.husband).toBe('I1')
    expect(f.wife).toBe('I2')
    expect(f.children).toEqual(['I3', 'I4'])
    expect(f.marriageDate?.dateKind).toBe('EXACT')
    if (f.marriageDate?.dateKind === 'EXACT') {
      expect(f.marriageDate.year).toBe(1900)
      expect(f.marriageDate.month).toBe(1)
      expect(f.marriageDate.day).toBe(12)
    }
    expect(f.marriagePlace).toBe('Surabaya, Jawa Timur')
    expect(f.divorceDate?.dateKind).toBe('RANGE')
  })

  it('returns empty array for input without FAM records', () => {
    const gedcom = ['0 HEAD', '1 GEDC', '2 VERS 7.0'].join('\n')
    expect(importFamilies(gedcom)).toEqual([])
  })

  it('keeps file order across multiple FAM records and skips INDI/HEAD', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Ani',
      '0 @F2@ FAM',
      '1 HUSB @I1@',
      '0 @F1@ FAM',
      '1 WIFE @I1@',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out.map((f) => f.xref)).toEqual(['F2', 'F1'])
    expect(out[0].husband).toBe('I1')
    expect(out[1].wife).toBe('I1')
  })

  it('keeps CHIL payloads in file order without dedup or fabrication', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '0 @I3@ INDI',
      '0 @F1@ FAM',
      '1 CHIL @I3@',
      '1 CHIL @I1@',
      '1 CHIL @I3@',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out[0].children).toEqual(['I3', 'I1', 'I3'])
  })

  it('parses a single-parent FAM without HUSB or WIFE', () => {
    const gedcom = [
      '0 @I2@ INDI',
      '0 @F1@ FAM',
      '1 CHIL @I2@',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out).toHaveLength(1)
    expect(out[0].husband).toBeUndefined()
    expect(out[0].wife).toBeUndefined()
    expect(out[0].children).toEqual(['I2'])
    expect(out[0].marriageDate).toBeUndefined()
    expect(out[0].marriagePlace).toBeUndefined()
    expect(out[0].divorceDate).toBeUndefined()
  })

  it('drops empty DATE and PLAC payloads inside MARR', () => {
    const gedcom = [
      '0 @F1@ FAM',
      '1 MARR',
      '2 DATE',
      '2 PLAC',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out[0].marriageDate).toBeUndefined()
    expect(out[0].marriagePlace).toBeUndefined()
  })

  it('preserves loose date precision through parseEventDate (ABT, BET..AND)', () => {
    const gedcom = [
      '0 @F1@ FAM',
      '1 MARR',
      '2 DATE ABT 1900',
      '1 DIV',
      '2 DATE BET 1901 AND 1910',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out[0].marriageDate?.dateKind).toBe('ABOUT')
    expect(out[0].divorceDate?.dateKind).toBe('RANGE')
    if (out[0].divorceDate?.dateKind === 'RANGE') {
      expect(out[0].divorceDate.from.year).toBe(1901)
      expect(out[0].divorceDate.to.year).toBe(1910)
    }
  })

  it('never throws on malformed GEDCOM, logs and yields best effort', () => {
    const broken = [
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '99 BOGUS',
      '1 WIFE @I2@',
    ].join('\n')
    const logs: string[] = []
    let out: ReturnType<typeof importFamilies> = []
    expect(() => {
      out = importFamilies(broken, (msg) => logs.push(msg))
    }).not.toThrow()
    expect(logs.length).toBeGreaterThan(0)
    expect(out.map((f) => f.husband)).toContain('I1')
  })

  it('skips FAM records without xref honestly via the logger', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 FAM',
      '1 HUSB @I1@',
      '0 @F1@ FAM',
      '1 WIFE @I2@',
    ].join('\n')
    const logs: string[] = []
    const out = importFamilies(gedcom, (msg) => logs.push(msg))
    expect(out).toHaveLength(1)
    expect(out[0].xref).toBe('F1')
    expect(out[0].wife).toBe('I2')
    expect(logs.some((m) => m.includes('xref'))).toBe(true)
  })

  it('ignores FAMS/FAMC/FSEM pointers as derivable', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '1 NAME Ani',
      '1 FAMS @F1@',
      '1 FAMC @F9@',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '2 FSEM X',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out).toHaveLength(1)
    expect(out[0].xref).toBe('F1')
    expect(out[0].husband).toBe('I1')
    expect(out[0].children).toEqual([])
  })

  it('keeps the first MARR occurrence when a record has several', () => {
    const gedcom = [
      '0 @F1@ FAM',
      '1 MARR',
      '2 DATE 1 JAN 1900',
      '1 MARR',
      '2 DATE 2 FEB 1950',
    ].join('\n')
    const out = importFamilies(gedcom)
    expect(out[0].marriageDate?.dateKind).toBe('EXACT')
    if (out[0].marriageDate?.dateKind === 'EXACT') {
      expect(out[0].marriageDate.year).toBe(1900)
    }
  })

  it('round-trips real exportGedcom70 output back into family summaries', () => {
    const members: FamilyMemberRecord[] = [
      makeMember({
        id: 'm1',
        name: 'Budi Santoso',
        gender: 'male',
        maritalStatus: 'married',
      }),
      makeMember({
        id: 'm2',
        name: 'Siti Aminah',
        gender: 'female',
        maritalStatus: 'married',
      }),
      makeMember({
        id: 'm3',
        name: 'Cica Santoso',
        gender: 'female',
        generation: 2,
      }),
    ]
    const relationships: MemberRelationship[] = [
      { id: 'r1', treeId: 'tree-1', memberId: 'm1', relatedId: 'm2', type: 'spouse' },
      { id: 'r2', treeId: 'tree-1', memberId: 'm1', relatedId: 'm3', type: 'parent' },
      { id: 'r3', treeId: 'tree-1', memberId: 'm2', relatedId: 'm3', type: 'parent' },
    ]
    const { gedcom, stats } = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    expect(stats.families).toBe(1)
    const out = importFamilies(gedcom)
    expect(out).toHaveLength(1)
    const f = out[0]
    expect(f.xref).toBe('F1')
    expect(f.husband).toBe('I1')
    expect(f.wife).toBe('I2')
    expect(f.children).toEqual(['I3'])
    // The exporter writes MARR Y without a DATE, so no marriage date
    // comes back; the payload stays honest instead of being fabricated.
    expect(f.marriageDate).toBeUndefined()
    expect(f.marriagePlace).toBeUndefined()
    expect(f.divorceDate).toBeUndefined()
  })
})
