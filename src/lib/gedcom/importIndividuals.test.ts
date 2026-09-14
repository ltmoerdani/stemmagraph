// Test importIndividuals (S1F5-A): 10 kasus inti urai INDI, termasuk
// round-trip nyata exportGedcom70 lalu importIndividuals. Kasus sanitasi
// tanggal/place detail sudah diuji di parseEventDate.test.ts dan
// placePayload.test.ts; di sini cukup wiring level lib.

import { describe, expect, it } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord } from '../adapters/types'

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

describe('importIndividuals', () => {
  it('parses one INDI with full name, sex, birth, death', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Budi /Santoso/',
      '1 SEX M',
      '1 BIRT',
      '2 DATE 12 JAN 1900',
      '2 PLAC Surabaya, Jawa Timur',
      '1 DEAT',
      '2 DATE BET 1970 AND 1980',
      '2 PLAC Jakarta',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out).toHaveLength(1)
    const p = out[0]
    expect(p.xref).toBe('I1')
    expect(p.name).toBe('Budi /Santoso/')
    expect(p.sex).toBe('M')
    expect(p.birthDate?.dateKind).toBe('EXACT')
    if (p.birthDate?.dateKind === 'EXACT') {
      expect(p.birthDate.year).toBe(1900)
      expect(p.birthDate.month).toBe(1)
      expect(p.birthDate.day).toBe(12)
    }
    expect(p.birthPlace).toBe('Surabaya, Jawa Timur')
    expect(p.deathDate?.dateKind).toBe('RANGE')
    expect(p.deathPlace).toBe('Jakarta')
  })

  it('returns empty array for input without INDI records', () => {
    const gedcom = ['0 HEAD', '1 GEDC', '2 VERS 7.0'].join('\n')
    expect(importIndividuals(gedcom)).toEqual([])
  })

  it('keeps file order across multiple INDI records and skips FAM/HEAD', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Ani',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '0 @I2@ INDI',
      '1 NAME Budi',
      '0 @I3@ INDI',
      '1 NAME Cica',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out.map((p) => p.xref)).toEqual(['I1', 'I2', 'I3'])
    expect(out.map((p) => p.name)).toEqual(['Ani', 'Budi', 'Cica'])
  })

  it('returns undefined fields for an INDI without NAME SEX BIRT DEAT', () => {
    const gedcom = ['0 @I1@ INDI'].join('\n')
    const out = importIndividuals(gedcom)
    expect(out).toHaveLength(1)
    expect(out[0].xref).toBe('I1')
    expect(out[0].name).toBeUndefined()
    expect(out[0].sex).toBeUndefined()
    expect(out[0].birthDate).toBeUndefined()
    expect(out[0].birthPlace).toBeUndefined()
    expect(out[0].deathDate).toBeUndefined()
    expect(out[0].deathPlace).toBeUndefined()
  })

  it('parses SEX X and ABOUT date precision', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '1 SEX X',
      '1 BIRT',
      '2 DATE ABT 1900',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out[0].sex).toBe('X')
    expect(out[0].birthDate?.dateKind).toBe('ABOUT')
    expect(out[0].birthDate?.dateKind === 'ABOUT' && out[0].birthDate.year).toBe(1900)
  })

  it('sanitizes PLAC whitespace and control characters via placePayload', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '1 BIRT',
      '2 PLAC   Bandung\tJawa  Barat  ',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out[0].birthPlace).toBe('Bandung Jawa Barat')
  })

  it('drops empty DATE and PLAC payloads', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '1 BIRT',
      '2 DATE',
      '2 PLAC',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out[0].birthDate).toBeUndefined()
    expect(out[0].birthPlace).toBeUndefined()
  })

  it('never throws on malformed GEDCOM, logs and yields best effort', () => {
    const broken = [
      '0 @I1@ INDI',
      '1 NAME Ani',
      '99 BOGUS',
      '1 SEX F',
    ].join('\n')
    const logs: string[] = []
    let out: ReturnType<typeof importIndividuals> = []
    expect(() => {
      out = importIndividuals(broken, (msg) => logs.push(msg))
    }).not.toThrow()
    expect(logs.length).toBeGreaterThan(0)
    expect(out.map((p) => p.name)).toContain('Ani')
  })

  it('recognizes the redacted living name marker as-is', () => {
    const gedcom = [
      '0 @I1@ INDI',
      '1 NAME [Living]',
    ].join('\n')
    const out = importIndividuals(gedcom)
    expect(out[0].name).toBe('[Living]')
  })

  it('round-trips real exportGedcom70 output back into individual summaries', () => {
    const members: FamilyMemberRecord[] = [
      makeMember({
        id: 'm1',
        name: 'Budi Santoso',
        gender: 'male',
        birthDate: '12 JAN 1900',
        birthPlace: 'Surabaya',
        isAlive: false,
        deathDate: 'BET 1970 AND 1980',
      }),
      makeMember({
        id: 'm2',
        name: 'Siti Aminah',
        gender: 'female',
        birthDate: '5 MAR 1905',
        birthPlace: 'Yogyakarta',
      }),
    ]
    const { gedcom } = exportGedcom70({
      members,
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    const out = importIndividuals(gedcom)
    expect(out).toHaveLength(2)
    expect(out[0].name).toBe('Budi Santoso')
    expect(out[0].sex).toBe('M')
    expect(out[0].birthDate?.dateKind).toBe('EXACT')
    expect(out[0].birthPlace).toBe('Surabaya')
    expect(out[0].deathDate?.dateKind).toBe('RANGE')
    expect(out[1].name).toBe('Siti Aminah')
    expect(out[1].sex).toBe('F')
    expect(out[1].birthPlace).toBe('Yogyakarta')
  })
})
