import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases eda Karo (v199-i, kind sibling, dual makna affine, tiga sumber lintas era)', () => {
  it('resolveAlias eda region Karo kembalikan kind sibling', () => {
    const r = resolveAlias('eda', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('resolveAlias eda region Karo depth 1', () => {
    expect(resolveAlias('eda', 'Karo')?.depth).toBe(1)
  })

  it('resolveAlias eda region Karo region Karo', () => {
    expect(resolveAlias('eda', 'Karo')?.region).toBe('Karo')
  })

  it('resolveAlias EDA huruf besar sama dengan eda (normalisasi lowercase)', () => {
    expect(resolveAlias('EDA', 'Karo')).toEqual(resolveAlias('eda', 'Karo'))
    expect(resolveAlias('EDA', 'Karo')).not.toBeNull()
  })

  it('resolveAlias dengan spasi di ujung: resolver aktual melakukan trim sehingga eda dengan spasi tetap hit', () => {
    expect(resolveAlias('eda ', 'Karo')).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.eda)
    expect(resolveAlias(' eda', 'Karo')).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.eda)
  })

  it('note memuat jejak sumber 1: KBBI VI e.da 1 Bt dengan rujukan notes/447', () => {
    expectNoteContains('Karo', 'eda', ['KBBI VI', 'e.da 1 Bt', 'notes/447'])
  })

  it('note memuat jejak sumber 2: OCR Kamus Karo 2001 hlm 64 panggilan terhadap istri abang', () => {
    expectNoteContains('Karo', 'eda', ['Kamus Karo 2001', 'hlm 64', 'istri abang'])
  })

  it('note memuat jejak sumber 3: van der Tuuk 1861 dengan rujukan notes/475', () => {
    expectNoteContains('Karo', 'eda', ['van der Tuuk 1861', 'notes/475', 'vokatif'])
  })

  it('note memuat glosa Belanda broeder\'s vrouw dan schoonzuster', () => {
    expectNoteContains('Karo', 'eda', ['broeder\'s vrouw', 'schoonzuster'])
  })

  it('note menyebut tiga sumber dan dual makna affine', () => {
    expectNoteContains('Karo', 'eda', ['TIGA SUMBER', 'dual makna affine'])
  })

  it('note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Karo', 'eda')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('resolveAlias eda tanpa region bernilai null: eda hanya ada di map regional Karo', () => {
    expect(resolveAlias('eda')).toBeNull()
  })

  it('resolveAlias eda region Toba bernilai null', () => {
    expect(resolveAlias('eda', 'Toba')).toBeNull()
  })

  it('guard: e.da dengan titik bernilai null, bentuk KBBI bukan key', () => {
    expect(resolveAlias('e.da', 'Karo')).toBeNull()
  })

  it('guard: eda- dengan tanda hubung bernilai null', () => {
    expect(resolveAlias('eda-', 'Karo')).toBeNull()
  })

  it('guard: objek Karo berisi tepat 19 key setelah lemirat masuk (v202-i add-only, sebelumnya 18)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(23) // v222-i bump 22 jadi 23 (kalimbubu)
    expect(keys).toContain('eda')
    expect(keys).toContain('lemirat')
  })

  it('guard: nihil key eda1 dan eda2 di objek Karo', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys).not.toContain('eda1')
    expect(keys).not.toContain('eda2')
    expect(resolveAlias('eda1', 'Karo')).toBeNull()
    expect(resolveAlias('eda2', 'Karo')).toBeNull()
  })

  it('regresi: sepemeren tetap kind cousin depth 1 region Karo', () => {
    const r = resolveAlias('sepemeren', 'Karo')
    expect(r?.kind).toBe('cousin')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('regresi: unjuken tetap kind property depth 0 region Karo', () => {
    const r = resolveAlias('unjuken', 'Karo')
    expect(r?.kind).toBe('property')
    expect(r?.depth).toBe(0)
    expect(r?.region).toBe('Karo')
  })

  it('regresi: diberu tetap kind partner depth 1 region Karo', () => {
    const r = resolveAlias('diberu', 'Karo')
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })
})
