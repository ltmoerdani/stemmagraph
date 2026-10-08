// Tests SURN marga export wiring (v252-vii): field marga pada
// FamilyMemberRecord ditulis sebagai satu substructure SURN di bawah
// struct NAME INDI (GEDCOM 7: SURN sah sebagai substructure NAME,
// kardinalitas {0:M}). Nilai ditulis verbatim tanpa normalisasi;
// NAME string tetap apa adanya. Member tanpa marga tidak menulis
// SURN kosong sehingga output byte-identik dengan perilaku lama.
// Clean mode meredaksi member living sehingga SURN ikut tak tertulis
// (marga bisa mengidentifikasi orang); full mode dan legacy default
// tetap menulis SURN bila marga ada. Fixture kecil didefinisikan di
// sini; fixtures round-trip existing tidak disentuh.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import { importIndividuals } from './importIndividuals'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

const EXPORTED_AT = new Date('2026-10-08T00:00:00Z')

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
    maritalStatus: 'married',
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

/** Couple a+b (I1+I2, F1) supaya tiap INDI membawa xref @In@. */
function couple(
  margaA?: string,
  margaB?: string,
): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return {
    members: [
      member({ id: 'a', marga: margaA }),
      member({ id: 'b', gender: 'female', marga: margaB }),
    ],
    relationships: [rel('r1', 'a', 'b', 'spouse')],
  }
}

function indiBlockOf(gedcom: string, xref: string): string[] {
  const lines = gedcom.split('\n')
  const start = lines.findIndex((l) => l === `0 @${xref}@ INDI`)
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && l.startsWith('0 '))
  return lines.slice(start, end === -1 ? lines.length : end)
}

function exportCouple(
  margaA?: string,
  margaB?: string,
  privacyMode?: 'clean' | 'full',
): string {
  return exportGedcom70({
    ...couple(margaA, margaB),
    exportedAt: EXPORTED_AT,
    ...(privacyMode === undefined ? {} : { privacyMode }),
  }).gedcom
}

describe('exportGedcom70 SURN marga export (v252-vii)', () => {
  it('t1: member bermarga menulis tepat satu SURN verbatim di bawah NAME', () => {
    const gedcom = exportCouple('Galingging', 'Sigalingging')
    const i1 = indiBlockOf(gedcom, 'I1')
    expect(i1).toContain('1 NAME Nama a')
    expect(i1.filter((l) => l === '2 SURN Galingging')).toHaveLength(1)
    const i2 = indiBlockOf(gedcom, 'I2')
    expect(i2.filter((l) => l === '2 SURN Sigalingging')).toHaveLength(1)
  })

  it('t2: SURN berada tepat di bawah NAME, setelah NICK bila ada', () => {
    const gedcom = exportGedcom70({
      members: [
        member({ id: 'a', marga: 'Galingging' }),
        member({ id: 'b', gender: 'female', nickname: 'B', marga: 'Sigalingging' }),
      ],
      relationships: [rel('r1', 'a', 'b', 'spouse')],
      exportedAt: EXPORTED_AT,
    }).gedcom
    const i1 = indiBlockOf(gedcom, 'I1')
    expect(i1.indexOf('1 NAME Nama a')).toBeGreaterThanOrEqual(0)
    expect(i1.indexOf('2 SURN Galingging')).toBe(
      i1.indexOf('1 NAME Nama a') + 1,
    )
    const i2 = indiBlockOf(gedcom, 'I2')
    expect(i2.indexOf('2 SURN Sigalingging')).toBe(
      i2.indexOf('2 NICK B') + 1,
    )
  })

  it('t3: member tanpa marga nihil SURN, undefined dan string kosong byte-identik', () => {
    const absent = exportCouple()
    const blank = exportCouple('', '')
    expect(absent).not.toMatch(/SURN/)
    expect(blank).toBe(absent)
  })

  it('t4: campuran bermarga dan tanpa marga, SURN hanya pada INDI bersangkutan', () => {
    const gedcom = exportCouple('Galingging', undefined)
    expect(indiBlockOf(gedcom, 'I1')).toContain('2 SURN Galingging')
    expect(indiBlockOf(gedcom, 'I2').join('\n')).not.toMatch(/SURN/)
  })

  it('t5: clean mode member redacted nihil SURN, NAME jadi [Living]', () => {
    const gedcom = exportCouple('Galingging', 'Sigalingging', 'clean')
    const i1 = indiBlockOf(gedcom, 'I1')
    expect(i1).toContain('1 NAME [Living]')
    expect(i1.join('\n')).not.toMatch(/SURN/)
    expect(indiBlockOf(gedcom, 'I2').join('\n')).not.toMatch(/SURN/)
  })

  it('t6: full mode member living bermarga tetap menulis SURN', () => {
    const gedcom = exportCouple('Galingging', 'Sigalingging', 'full')
    expect(indiBlockOf(gedcom, 'I1')).toContain('2 SURN Galingging')
    expect(indiBlockOf(gedcom, 'I2')).toContain('2 SURN Sigalingging')
  })

  it('t7: legacy default (privacyMode absent) menulis SURN, identik dengan full mode', () => {
    const legacy = exportCouple('Galingging', 'Sigalingging')
    const full = exportCouple('Galingging', 'Sigalingging', 'full')
    expect(legacy).toBe(full)
    expect(legacy).toMatch(/2 SURN Galingging/)
  })

  it('t8: marga verbatim tanpa normalisasi, termasuk varian berhyphen dan multi kata', () => {
    const gedcom = exportCouple('Perangin-angin', 'Sembiring Tek Tek')
    expect(indiBlockOf(gedcom, 'I1')).toContain('2 SURN Perangin-angin')
    expect(indiBlockOf(gedcom, 'I2')).toContain('2 SURN Sembiring Tek Tek')
    expect(gedcom).not.toMatch(/Perangin angin SURN|SURN PeranginAngin/)
  })

  it('t9: round-trip kecil export lalu import balik tidak merusak atau menduplikasi marga', () => {
    const gedcom = exportCouple('Galingging', 'Sigalingging')
    const individuals = importIndividuals(gedcom)
    expect(individuals).toHaveLength(2)
    expect(individuals[0]?.xref).toBe('I1')
    expect(individuals[0]?.name).toBe('Nama a')
    expect(individuals[1]?.name).toBe('Nama b')
    // Marga tidak menyusup ke payload NAME (tidak terduplikasi),
    // jalur import tak berubah: struktur terbaca utuh.
    for (const individual of individuals) {
      expect(individual.name).not.toContain('Galingging')
      expect(individual.name).not.toContain('Sigalingging')
      expect((individual.name.match(/SURN/g) ?? []).length).toBe(0)
    }
    expect(individuals[0]?.sex).toBe('M')
    expect(individuals[1]?.sex).toBe('F')
  })
})
