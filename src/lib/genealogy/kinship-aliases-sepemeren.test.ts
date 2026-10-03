import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases sepemeren Karo (v198-i, kind cousin makna MZD, dua sumber buku)', () => {
  it('entry sepemeren ada di map regional Karo', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.sepemeren).toBeDefined()
  })

  it('resolveAlias sepemeren region Karo kembalikan kind cousin', () => {
    const r = resolveAlias('sepemeren', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('resolveAlias sepemeren region Karo depth 1', () => {
    const r = resolveAlias('sepemeren', 'Karo')
    expect(r?.depth).toBe(1)
  })

  it('resolveAlias sepemeren region Karo region Karo', () => {
    const r = resolveAlias('sepemeren', 'Karo')
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias sepemeren tanpa region bernilai null: sepemeren hanya ada di map regional Karo', () => {
    expect(resolveAlias('sepemeren')).toBeNull()
  })

  it('resolveAlias sepemeren region Toba bernilai null: Toba tidak mewarisi Karo', () => {
    expect(resolveAlias('sepemeren', 'Toba')).toBeNull()
  })

  it('resolveAlias sepemeren region Sunda bernilai null: region tak terdaftar tidak mewarisi', () => {
    expect(resolveAlias('sepemeren', 'Sunda')).toBeNull()
  })

  it('normalisasi spasi: sepemeren dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' sepemeren ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('normalisasi kapitalisasi: SEPEMEREN tetap kena lowercase', () => {
    const r = resolveAlias('SEPEMEREN', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('tidak ada homonim: sepemeren hanya satu entri, tidak ada di map utama maupun Toba', () => {
    expect(KINSHIP_ALIASES.sepemeren).toBeUndefined()
    expect(KINSHIP_ALIASES_REGIONAL.Toba.sepemeren).toBeUndefined()
    const karoHits = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).filter((k) => k === 'sepemeren')
    expect(karoHits.length).toBe(1)
  })

  it('note memuat sumber pertama Singarimbun 1975 beserta judul dan label diagram impal sepemeren', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    expect(e.note).toContain('Singarimbun 1975')
    expect(e.note).toContain('Kinship, descent, and alliance among the Karo Batak')
    expect(e.note).toContain('impal sepemeren')
  })

  it('note memuat sumber kedua Iwabuchi 1994 beserta judul dan rujukan Singarimbun 1975: 202-3', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    expect(e.note).toContain('Iwabuchi 1994')
    expect(e.note).toContain('The people of the Alas Valley')
    expect(e.note).toContain('pemeRen')
    expect(e.note).toContain('202-3')
  })

  it('note memuat makna MZD dan frasa turang sepemeren', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    expect(e.note).toContain('MZD')
    expect(e.note).toContain('turang sepemeren')
    expect(e.note).toContain('lurang sepemeren')
  })

  it('note memuat penanda dua sumber dan referensi notes/466', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    expect(e.note).toContain('DUA SUMBER')
    expect(e.note).toContain('notes/466')
  })

  it('note tidak memuat em dash', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    expect(e.note).not.toContain('\u2014')
  })

  it('exact-key lookup: kunci sepemeren langsung kena di map Karo tanpa resolve', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['sepemeren']
    expect(e).toBeDefined()
    expect(e.kind).toBe('cousin')
    expect(e.depth).toBe(1)
  })

  it('struktur field konsisten dengan entry Karo lain (impal, unjuken): kind depth region note', () => {
    const s = KINSHIP_ALIASES_REGIONAL.Karo.sepemeren
    const u = KINSHIP_ALIASES_REGIONAL.Karo.unjuken
    expect(Object.keys(s).sort()).toEqual(Object.keys(u).sort())
    expect(Object.keys(s).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })

  it('regresi: impal Karo tetap cousin dan unjuken tetap property, tidak tertimpa sepemeren', () => {
    const impal = resolveAlias('impal', 'Karo')
    expect(impal?.kind).toBe('cousin')
    const unjuken = resolveAlias('unjuken', 'Karo')
    expect(unjuken?.kind).toBe('property')
    expect(unjuken?.depth).toBe(0)
  })

  it('negatif: istilah tak dikenal bernilai null di region Karo', () => {
    expect(resolveAlias('bukanistilahkekerabatan', 'Karo')).toBeNull()
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('sepemeren', 'Karo')
    const b = resolveAlias('sepemeren', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.sepemeren)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key setelah sepemeren masuk (v198-i add-only, sebelumnya 16)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys).toEqual([
      'bapa nguda',
      'bapa tua',
      'batangna',
      'bibi',
      'diberu',
      'eda',
      'impal',
      'kaka',
      'kempu',
      'lemirat',
      'ngalih',
      'ngerbani',
      'nini',
      'nini bulang',
      'nini ribu',
      'pak tua',
      'pak uda',
      'sepemeren',
      'sukut',
      'turangku',
      'unjuken',
    ])
    expect(keys.length).toBe(21) // v207-i bump 20 jadi 21 (ngalih)
  })

  it('guard: objek Toba tetap 5 key amangboru butet iboto ompung suhut pariban dan map regional tetap dua region (v209-i bump, amangboru add-only)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual(['amangboru', 'boru', 'butet', 'haha', 'iboto', 'lae', 'namboru', 'ompung suhut', 'pariban', 'tulang'])
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Simalungun', 'Toba'])
  })
})
