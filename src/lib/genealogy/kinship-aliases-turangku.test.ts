import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases turangku Karo (v195-i, jalur buku Search Inside)', () => {
  it('resolveAlias turangku tanpa region bernilai null: turangku hanya ada di map regional Karo', () => {
    expect(resolveAlias('turangku')).toBeNull()
  })

  it('resolveAlias turangku region Karo kembalikan entri partner depth 1', () => {
    const r = resolveAlias('turangku', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias turangku region Toba bernilai null: Toba tidak mewarisi Karo', () => {
    expect(resolveAlias('turangku', 'Toba')).toBeNull()
  })

  it('resolveAlias turangku region Sunda bernilai null: region tak terdaftar tidak mewarisi', () => {
    expect(resolveAlias('turangku', 'Sunda')).toBeNull()
  })

  it('normalisasi spasi: turangku dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' turangku ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
  })

  it('normalisasi kapitalisasi: TURANGKU tetap kena lowercase', () => {
    const r = resolveAlias('TURANGKU', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
  })

  it('struktur entri turangku: note memuat empat sumber buku dan referensi evidence', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.turangku
    expect(karo).toBeDefined()
    expect(karo.note).toContain('Singarimbun')
    expect(karo.note).toContain('Kipp')
    expect(karo.note).toContain('Rae')
    expect(karo.note).toContain('Iwabuchi')
    expect(karo.note).toContain('notes/464')
  })

  it('struktur entri turangku: note memuat varian denotasi WBW HZH WMBD', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.turangku
    expect(karo.note).toContain('WBW')
    expect(karo.note).toContain('HZH')
    expect(karo.note).toContain('WMBD')
  })

  it('struktur entri turangku: note menyebut pragmatik rebu avoidance lintas gender ego', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.turangku
    expect(karo.note).toContain('rebu avoidance')
    expect(karo.note).toContain('lintas gender ego')
  })

  it('regresi: diberu Karo dari v194-i tidak tertimpa entri turangku', () => {
    const r = resolveAlias('diberu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
  })

  it('regresi: sukut Karo dari v192-i tetap sibling depth 1, tidak tertimpa', () => {
    const r = resolveAlias('sukut', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('turangku', 'Karo')
    const b = resolveAlias('turangku', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.turangku)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key, turangku masuk (v196-i bump)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys.length).toBe(21) // v207-i bump 20 jadi 21 (ngalih)
    expect(keys).toContain('turangku')
    expect(keys).toContain('diberu')
  })

  it('guard: objek Toba tetap 5 key amangboru butet iboto ompung suhut pariban dan map regional tetap dua region (v209-i bump, amangboru add-only)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual(['amangboru', 'boru', 'butet', 'haha', 'iboto', 'lae', 'namboru', 'ompung suhut', 'pahompu','pariban', 'tulang'])
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Simalungun', 'Toba'])
  })
})
