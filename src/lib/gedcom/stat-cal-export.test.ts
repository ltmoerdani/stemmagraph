// Unit test wiring STAT FAMC dan kalender DATE pada export GEDCOM 7
// (GOAL v125 sub-fase C). Fokus: STAT enum dan raw extTag keluar apa
// adanya di wire, tag kalender dan PHRASE dipertahankan utuh tanpa
// konversi, FROM-TO dan BET-AND tetap dua semantik berbeda, dan NIHIL
// perubahan output saat input tidak membawa famcStat maupun kalender.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

const EXPORTED_AT = new Date('2026-09-20T00:00:00Z')

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
  return { id, treeId: 'tree-1', memberId, relatedId, type }
}

function coupleWithChild() {
  const members = [
    member({ id: 'a', name: 'Ayah', gender: 'male' }),
    member({ id: 'b', name: 'Ibu', gender: 'female' }),
    member({ id: 'c', name: 'Anak', generation: 2 }),
  ]
  const relationships = [
    rel('r1', 'a', 'b', 'spouse'),
    rel('r2', 'a', 'c', 'parent'),
    rel('r3', 'b', 'c', 'parent'),
  ]
  return { members, relationships }
}

function findLine(text: string, needle: string): string | undefined {
  return text.split('\n').find((l) => l.includes(needle))
}

describe('stat-cal export wiring (v125-ii-c)', () => {
  it('menulis STAT enum PROVEN apa adanya di wire di bawah FAMC', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom } = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
      famcStat: { c: 'PROVEN' },
    })
    expect(findLine(gedcom, '2 STAT PROVEN')).toBeDefined()
  })

  it('menulis STAT raw extTag utuh tanpa normalisasi', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom } = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
      famcStat: { c: '_CUSTOM_thing' },
    })
    expect(findLine(gedcom, '2 STAT _CUSTOM_thing')).toBeDefined()
  })

  it('menulis DATE berkalender utuh tanpa konversi', () => {
    const { members, relationships } = coupleWithChild()
    const withCal = members.map((m) =>
      m.id === 'c' ? { ...m, birthDate: '@#DGREGORIAN@ 15 APR 1900' } : m,
    )
    const { gedcom } = exportGedcom70({
      members: withCal,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    const dateLine = findLine(gedcom, '@#DGREGORIAN@ 15 APR 1900')
    expect(dateLine).toBeDefined()
    expect(dateLine?.includes('DATE')).toBe(true)
  })

  it('menulis PHRASE utuh di payload DATE', () => {
    const { members, relationships } = coupleWithChild()
    const withPhrase = members.map((m) =>
      m.id === 'c'
        ? { ...m, birthDate: 'ABT 14 MAR 1731/32 (PHRASE: Old Style)' }
        : m,
    )
    const { gedcom } = exportGedcom70({
      members: withPhrase,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    const dateLine = findLine(gedcom, 'Old Style')
    expect(dateLine).toBeDefined()
    expect(dateLine?.includes('DATE')).toBe(true)
  })

  it('FROM-TO keluar utuh dan BET-AND tetap BET..AND, tak tertukar', () => {
    const { members, relationships } = coupleWithChild()
    const withFrom = members.map((m) =>
      m.id === 'c' ? { ...m, birthDate: 'FROM 1900 TO 1910' } : m,
    )
    const { gedcom: gedcomFrom } = exportGedcom70({
      members: withFrom,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    expect(findLine(gedcomFrom, 'FROM 1900 TO 1910')).toBeDefined()

    const withBet = members.map((m) =>
      m.id === 'c' ? { ...m, birthDate: 'BET 1900 AND 1910' } : m,
    )
    const { gedcom: gedcomBet } = exportGedcom70({
      members: withBet,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    const betLine = findLine(gedcomBet, 'BET 1900 AND 1910')
    expect(betLine).toBeDefined()
    expect(betLine?.includes('DATE')).toBe(true)
    expect(findLine(gedcomBet, 'FROM 1900 TO 1910')).toBeUndefined()
  })

  it('output identik baseline saat input nihil famcStat dan nihil kalender', () => {
    const { members, relationships } = coupleWithChild()
    const base = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    const withExplicitEmpty = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
      famcStat: {},
    })
    expect(withExplicitEmpty.gedcom).toBe(base.gedcom)
  })

  it('tanpa famcStat nihil STAT ditulis (regresi)', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom } = exportGedcom70({
      members,
      relationships,
      exportedAt: EXPORTED_AT,
    })
    expect(gedcom.includes('STAT ')).toBe(false)
  })
})