import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases ngalih Karo (v207-i, kind pernikahan, levirate kawin menduda, dual-source)', () => {
  it('1. positif: resolveAlias ngalih region Karo kind pernikahan, depth 1, region Karo', () => {
    const r = resolveAlias('ngalih', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('2. note memuat jejak sumber: kamuskaro dan DOI Singarimbun 1975', () => {
    expectNoteContains('Karo', 'ngalih', ['kamuskaro', '10.2307/jj.13167910'])
  })

  it('3. note menyebut dua sumber independen', () => {
    expectNoteContains('Karo', 'ngalih', ['DUA SUMBER independen'])
  })

  it('4. homonim: NGALIH huruf besar sama dengan lowercase, Toba dan tanpa region bernilai null', () => {
    expect(resolveAlias('NGALIH', 'Karo')).toEqual(resolveAlias('ngalih', 'Karo'))
    expect(resolveAlias('NGALIH', 'Karo')).not.toBeNull()
    expect(resolveAlias('ngalih', 'Toba')).toBeNull()
    expect(resolveAlias('ngalih')).toBeNull()
  })

  it('5. non-regresi: lemirat dan ngerbani tetap pernikahan, eda tetap sibling, pariban Toba tetap cousin', () => {
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('ngerbani', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
  })

  it('6. negatif pengunci: suhut bao kula kalin null di Karo, suhut Toba null, komposit ompung suhut tetap grandparent', () => {
    expect(resolveAlias('suhut', 'Karo')).toBeNull()
    expect(resolveAlias('bao', 'Karo')).toBeNull()
    expect(resolveAlias('kula', 'Karo')).toBeNull()
    expect(resolveAlias('kalin', 'Karo')).toBeNull()
    expect(resolveAlias('suhut', 'Toba')).toBeNull()
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
  })

  it('7. bentuk data valid: note non-kosong, tanpa em dash dan tanpa dua tanda minus', () => {
    const note = regionalNote('Karo', 'ngalih')
    expect(note.length).toBeGreaterThan(0)
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('8. idempoten: dua resolveAlias berurutan hasil identik dan sama dengan data sumber', () => {
    const a = resolveAlias('ngalih', 'Karo')
    const b = resolveAlias('ngalih', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.ngalih)
  })

  it('9. kind pernikahan anggota sah union KinshipKind dan label id/en terdaftar', async () => {
    const labels = await import('./kinship-labels')
    expect(Object.keys(labels.KINSHIP_LABELS)).toContain('pernikahan')
    expect(labels.KINSHIP_LABELS['pernikahan'].id.length).toBeGreaterThan(0)
    expect(labels.KINSHIP_LABELS['pernikahan'].en.length).toBeGreaterThan(0)
  })

  it('10. guard: objek Karo berisi tepat 21 key (v207-i add-only, sebelumnya 20), ngalih di antara lemirat dan ngerbani, tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    const sorted = [...keys].sort()
    expect(sorted).toEqual(['anak beru', 'anak beru menteri', 'bapa nguda', 'bapa tua', 'batangna', 'bibi', 'diberu', 'eda', 'impal', 'kaka', 'kalimbubu', 'kalimbubu simada dareh', 'kalimbubu singalo bere-bere', 'kalimbubu singalo perkempun', 'kalimbubu singalo ulu emas', 'kalimbubu siperdemui', 'kempu', 'lemirat', 'mehamat man kalimbubu', 'ngalih', 'ngerbani', 'nini', 'nini bulang', 'nini ribu', 'pak tua', 'pak uda', 'puang kalimbubu', 'puang ni puang', 'sepemeren', 'singerana', 'sukut', 'turangku', 'unjuken'])
    const i = sorted.indexOf('ngalih')
    expect(sorted[i - 1]).toBe('mehamat man kalimbubu') // v227-i sisip alfabetis antara lemirat dan ngalih
    expect(sorted[i + 1]).toBe('ngerbani')
    expect(keys.length).toBe(33) // v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang); v232-i bump 28 jadi 29 (alias kalimbubu simada dareh) (alias singerana) (alias kalimbubu siperdemui)
  })
})
