import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases pariban Toba (v205-i, kind cousin, tiga sumber DOI terverifikasi Crossref)', () => {
  it('1. resolveAlias pariban region Toba kembalikan kind cousin', () => {
    const r = resolveAlias('pariban', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('2. resolveAlias pariban region Toba depth 1', () => {
    expect(resolveAlias('pariban', 'Toba')?.depth).toBe(1)
  })

  it('3. resolveAlias pariban region Toba region Toba', () => {
    expect(resolveAlias('pariban', 'Toba')?.region).toBe('Toba')
  })

  it('4. homonim: PARIBAN huruf besar sama dengan pariban (normalisasi lowercase)', () => {
    expect(resolveAlias('PARIBAN', 'Toba')).toEqual(resolveAlias('pariban', 'Toba'))
    expect(resolveAlias('PARIBAN', 'Toba')).not.toBeNull()
  })

  it('5. resolveAlias pariban tanpa region bernilai null: pariban hanya di map regional Toba', () => {
    expect(resolveAlias('pariban')).toBeNull()
  })

  it('6. resolveAlias pariban region Karo bernilai null: tidak bentrok kluster Karo', () => {
    expect(resolveAlias('pariban', 'Karo')).toBeNull()
  })

  it('7. note memuat sumber 1: Wati 2017 Syiar Hukum Unisba DOI 10.29313/sh.v15i1.2216', () => {
    expectNoteContains('Toba', 'pariban', ['Wati 2017', '10.29313/sh.v15i1.2216'])
  })

  it('8. note memuat sumber 2: Situngkir Putrijanji 2026 JIM DOI 10.38035/jim.v5i1.1942', () => {
    expectNoteContains('Toba', 'pariban', ['Situngkir Putrijanji 2026', '10.38035/jim.v5i1.1942'])
  })

  it('9. note memuat sumber 3: Vergouwen 1964 Springer DOI 10.1007/978-94-015-1035-6', () => {
    expectNoteContains('Toba', 'pariban', ['Vergouwen 1964', '10.1007/978-94-015-1035-6'])
  })

  it('10. note menyebut TIGA SUMBER dan catatan arah cross-cousin', () => {
    expectNoteContains('Toba', 'pariban', ['TIGA SUMBER', 'cross-cousin'])
  })

  it('11. note tidak memuat em dash maupun dua tanda minus', () => {
    const note = regionalNote('Toba', 'pariban')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('12. negatif pengunci: istilah Toba kandidat lain (kula ari situmba) tetap nihil alias', () => {
    expect(resolveAlias('kula', 'Toba')).toBeNull()
    expect(resolveAlias('ari', 'Toba')).toBeNull()
    expect(resolveAlias('situmba', 'Toba')).toBeNull()
  })

  it('13. non-duplikat struktural: key pariban tepat satu di blok Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'pariban').length).toBe(1)
  })

  it('14. idempoten struktur: keys Toba sort deterministik, pariban masuk, butet tetap', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()
    expect(keys).toContain('pariban')
    expect(keys).toContain('butet')
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('15. regresi homonim: sepemeren Karo tetap cousin, eda tetap sibling, lemirat tetap pernikahan', () => {
    expect(resolveAlias('sepemeren', 'Karo')?.kind).toBe('cousin')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
  })

  it('16. regresi butet Toba tetap utuh', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
  })
})
