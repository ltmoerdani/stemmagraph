// Test importPlan SEX fidelity (v262): SEX payload dari sumber diteruskan
// verbatim ke PlannedMember.sexGed tanpa normalisasi tanpa trim, sementara
// PlannedGender tetap 3 nilai (male/female/other) seperti sebelumnya.
// Kasus: SEX U, SEX X, nilai asing, tanpa SEX, dan nilai phrase liar.
// Semua kasus lewat importIndividuals (urai GEDCOM nyata) lalu
// buildImportPlan agar wiring parser-plan teruji sekaligus.

import { describe, expect, it } from 'vitest'
import { buildImportPlan } from './importPlan'
import { importIndividuals } from './importIndividuals'

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0']

function planFromIndi(body: string[]) {
  const gedcom = [...HEAD, ...body].join('\n')
  return buildImportPlan(importIndividuals(gedcom), [])
}

describe('importPlan sexGed verbatim (v262)', () => {
  it('SEX U dipetakan verbatim ke sexGed dan gender tetap other', () => {
    const plan = planFromIndi(['0 @I1@ INDI', '1 NAME A /A/', '1 SEX U'])
    expect(plan.members).toHaveLength(1)
    expect(plan.members[0].sexGed).toBe('U')
    expect(plan.members[0].gender).toBe('other')
  })

  it('SEX X dipetakan verbatim ke sexGed dan gender tetap other', () => {
    const plan = planFromIndi(['0 @I1@ INDI', '1 NAME B /B/', '1 SEX X'])
    expect(plan.members[0].sexGed).toBe('X')
    expect(plan.members[0].gender).toBe('other')
  })

  it('SEX M dan SEX F tetap jalur lama: sexGed verbatim plus gender male/female', () => {
    const plan = planFromIndi([
      '0 @I1@ INDI', '1 NAME C /C/', '1 SEX M',
      '0 @I2@ INDI', '1 NAME D /D/', '1 SEX F',
    ])
    expect(plan.members[0].sexGed).toBe('M')
    expect(plan.members[0].gender).toBe('male')
    expect(plan.members[1].sexGed).toBe('F')
    expect(plan.members[1].gender).toBe('female')
  })

  it('SEX nilai asing ZZZ masuk sexGed apa adanya tanpa melumpuhkan gender', () => {
    const plan = planFromIndi(['0 @I1@ INDI', '1 NAME E /E/', '1 SEX ZZZ'])
    expect(plan.members[0].sexGed).toBe('ZZZ')
    expect(plan.members[0].gender).toBe('other')
  })

  it('record tanpa SEX menghasilkan sexGed undefined', () => {
    const plan = planFromIndi(['0 @I1@ INDI', '1 NAME F /F/'])
    expect(plan.members[0].sexGed).toBeUndefined()
    expect(plan.members[0].gender).toBe('other')
  })

  it('SEX payload phrase liar diteruskan tanpa trim tanpa normalisasi', () => {
    const plan = planFromIndi(['0 @I1@ INDI', '1 NAME G /G/', '1 SEX (tak diketahui) '])
    expect(plan.members[0].sexGed).toBe('(tak diketahui) ')
    expect(plan.members[0].gender).toBe('other')
  })

  it('gender tetap 3 nilai untuk SEX U dan X (bukan other-only yang menghapus sex)', () => {
    const plan = planFromIndi([
      '0 @I1@ INDI', '1 NAME H /H/', '1 SEX U',
      '0 @I2@ INDI', '1 NAME I /I/', '1 SEX X',
    ])
    const genders = plan.members.map((m) => m.gender)
    for (const g of genders) {
      expect(['male', 'female', 'other']).toContain(g)
    }
    expect(plan.members.map((m) => m.sexGed)).toEqual(['U', 'X'])
  })
})
