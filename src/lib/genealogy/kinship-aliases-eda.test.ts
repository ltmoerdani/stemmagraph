import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

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
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('e.da 1 Bt')
    expect(note).toContain('notes/447')
  })

  it('note memuat jejak sumber 2: OCR Kamus Karo 2001 hlm 64 panggilan terhadap istri abang', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
    expect(note).toContain('Kamus Karo 2001')
    expect(note).toContain('hlm 64')
    expect(note).toContain('istri abang')
  })

  it('note memuat jejak sumber 3: van der Tuuk 1861 dengan rujukan notes/475', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
    expect(note).toContain('van der Tuuk 1861')
    expect(note).toContain('notes/475')
    expect(note).toContain('vokatif')
  })

  it('note memuat glosa Belanda broeder\'s vrouw dan schoonzuster', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
    expect(note).toContain('broeder\'s vrouw')
    expect(note).toContain('schoonzuster')
  })

  it('note menyebut tiga sumber dan dual makna affine', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
    expect(note).toContain('TIGA SUMBER')
    expect(note).toContain('dual makna affine')
  })

  it('note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo.eda.note
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

  it('guard: objek Karo berisi tepat 18 key setelah eda masuk (v199-i add-only, sebelumnya 17)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(18)
    expect(keys).toContain('eda')
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
