import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases batangna Karo (v196-i, jalur buku Search Inside)', () => {
  it('resolveAlias batangna tanpa region bernilai null: batangna hanya ada di map regional Karo', () => {
    expect(resolveAlias('batangna')).toBeNull()
  })

  it('resolveAlias batangna region Karo kembalikan entri child depth 1', () => {
    const r = resolveAlias('batangna', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias batangna region Toba bernilai null: Toba tidak mewarisi Karo', () => {
    expect(resolveAlias('batangna', 'Toba')).toBeNull()
  })

  it('resolveAlias batangna region Sunda bernilai null: region tak terdaftar tidak mewarisi', () => {
    expect(resolveAlias('batangna', 'Sunda')).toBeNull()
  })

  it('normalisasi spasi: batangna dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' batangna ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
  })

  it('normalisasi kapitalisasi: BATANGNA tetap kena lowercase', () => {
    const r = resolveAlias('BATANGNA', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
  })

  it('struktur entri batangna: note memuat empat jangkar sumber', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.batangna
    expect(karo).toBeDefined()
    expect(karo.note).toContain('batangna')
    expect(karo.note).toContain('Neumann')
    expect(karo.note).toContain('van der Tuuk')
    expect(karo.note).toContain('unjuken')
  })

  it('struktur entri batangna: note menyebut dual makna literal trunk dan mas kawin', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.batangna
    expect(karo.note).toContain('dual makna')
    expect(karo.note).toContain('trunk')
    expect(karo.note).toContain('mas kawin')
  })

  it('struktur entri batangna: note memuat referensi notes/468', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.batangna
    expect(karo.note).toContain('notes/468')
  })

  it('regresi: turangku Karo dari v195-i tidak tertimpa entri batangna', () => {
    const r = resolveAlias('turangku', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
  })

  it('regresi: diberu Karo dari v194-i tetap partner depth 1, tidak tertimpa', () => {
    const r = resolveAlias('diberu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('batangna', 'Karo')
    const b = resolveAlias('batangna', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.batangna)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key, batangna masuk (v196-i add-only)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys.length).toBe(21) // v207-i bump 20 jadi 21 (ngalih)
    expect(keys).toContain('batangna')
    expect(keys).toContain('turangku')
  })

  it('guard: objek Toba tetap 4 key butet iboto ompung suhut pariban dan map regional tetap dua region (v206-i bump, ompung suhut add-only)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual(['amangboru', 'butet', 'iboto', 'ompung suhut', 'pariban'])
origin/develop
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Toba'])
  })
})
