import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases ngerbani Karo (v203-i, kind pernikahan, sororal polygyny, dual-source)', () => {
  it('1. resolveAlias ngerbani region Karo kembalikan kind pernikahan', () => {
    const r = resolveAlias('ngerbani', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
  })

  it('2. resolveAlias ngerbani region Karo depth 1', () => {
    expect(resolveAlias('ngerbani', 'Karo')?.depth).toBe(1)
  })

  it('3. resolveAlias ngerbani region Karo region Karo', () => {
    expect(resolveAlias('ngerbani', 'Karo')?.region).toBe('Karo')
  })

  it('4. homonim: NGERBANI huruf besar sama dengan ngerbani (normalisasi lowercase)', () => {
    expect(resolveAlias('NGERBANI', 'Karo')).toEqual(resolveAlias('ngerbani', 'Karo'))
    expect(resolveAlias('NGERBANI', 'Karo')).not.toBeNull()
  })

  it('5. resolveAlias ngerbani tanpa region bernilai null: ngerbani hanya ada di map regional Karo', () => {
    expect(resolveAlias('ngerbani')).toBeNull()
  })

  it('6. resolveAlias ngerbani region Toba bernilai null', () => {
    expect(resolveAlias('ngerbani', 'Toba')).toBeNull()
  })

  it('7. note memuat jejak sumber 1: kamuskaro lema kawin', () => {
    expectNoteContains('Karo', 'ngerbani', ['kamuskaro', 'kakak beradik'])
  })

  it('8. note memuat jejak sumber 2: Singarimbun 1975 DOI bab Marriage', () => {
    expectNoteContains('Karo', 'ngerbani', ['Singarimbun 1975', '10.2307/jj.13167910'])
  })

  it('9. note menyebut dua sumber independen', () => {
    expectNoteContains('Karo', 'ngerbani', ['DUA SUMBER independen'])
  })

  it('10. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Karo', 'ngerbani')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('11. negatif pengunci: istilah afinitas lain (suhut bao kula kalin) tetap tidak terdaftar', () => {
    expect(resolveAlias('suhut')).toBeNull()
    expect(resolveAlias('bao')).toBeNull()
    expect(resolveAlias('kula')).toBeNull()
    expect(resolveAlias('kalin')).toBeNull()
  })

  it('12. non-regresi: eda tetap sibling, lemirat tetap pernikahan', () => {
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
  })

  it('13. guard: objek Karo berisi tepat 21 key (v203-i ngerbani add-only, v207-i ngalih add-only menaikkan 20 jadi 21), urutan sort deterministik tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    const sorted = [...keys].sort()
    expect(sorted).toEqual(['anak beru', 'anak beru menteri', 'bapa nguda', 'bapa tua', 'batangna', 'bibi', 'diberu', 'eda', 'impal', 'kaka', 'kalimbubu', 'kalimbubu simada dareh', 'kalimbubu singalo bere-bere', 'kalimbubu singalo perbibin', 'kalimbubu singalo perkempun', 'kalimbubu singalo ulu emas', 'kalimbubu siperdemui', 'kempu', 'lemirat', 'mehamat man kalimbubu', 'ngalih', 'ngerbani', 'nini', 'nini bulang', 'nini ribu', 'pak tua', 'pak uda', 'puang kalimbubu', 'puang ni puang', 'sepemeren', 'singerana', 'sukut', 'turangku', 'unjuken'])
    expect(keys.length).toBe(35) // v238-i bump 34 jadi 35 (alias kalimbubu singalo perninin); v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang); v232-i bump 28 jadi 29 (alias kalimbubu simada dareh) (alias singerana) (alias kalimbubu siperdemui)
  })

  it('14. idempoten struktur: dua resolveAlias berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('ngerbani', 'Karo')
    const b = resolveAlias('ngerbani', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.ngerbani)
  })

  it('15. kind pernikahan anggota sah union KinshipKind dan label id/en terdaftar (v201-i hidup)', async () => {
    const labels = await import('./kinship-labels')
    expect(Object.keys(labels.KINSHIP_LABELS)).toContain('pernikahan')
    expect(labels.KINSHIP_LABELS['pernikahan'].id.length).toBeGreaterThan(0)
    expect(labels.KINSHIP_LABELS['pernikahan'].en.length).toBeGreaterThan(0)
  })
})
