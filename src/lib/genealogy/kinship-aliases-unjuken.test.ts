import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases unjuken Karo (v197-ii, kind property leksikon mas kawin)', () => {
  it('entry unjuken ada di map regional Karo', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.unjuken).toBeDefined()
  })

  it('resolveAlias unjuken region Karo kembalikan kind property', () => {
    const r = resolveAlias('unjuken', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('resolveAlias unjuken region Karo depth 0: frasa kind property tidak bergantung depth', () => {
    const r = resolveAlias('unjuken', 'Karo')
    expect(r?.depth).toBe(0)
  })

  it('resolveAlias unjuken region Karo region Karo', () => {
    const r = resolveAlias('unjuken', 'Karo')
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias unjuken tanpa region bernilai null: unjuken hanya ada di map regional Karo', () => {
    expect(resolveAlias('unjuken')).toBeNull()
  })

  it('resolveAlias unjuken region Toba bernilai null: Toba tidak mewarisi Karo', () => {
    expect(resolveAlias('unjuken', 'Toba')).toBeNull()
  })

  it('resolveAlias unjuken region Sunda bernilai null: region tak terdaftar tidak mewarisi', () => {
    expect(resolveAlias('unjuken', 'Sunda')).toBeNull()
  })

  it('normalisasi spasi: unjuken dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' unjuken ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('normalisasi kapitalisasi: UNJUKEN tetap kena lowercase', () => {
    const r = resolveAlias('UNJUKEN', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('tidak ada homonim: unjuken hanya satu entri, tidak ada di map utama maupun Toba', () => {
    expect(KINSHIP_ALIASES.unjuken).toBeUndefined()
    expect(KINSHIP_ALIASES_REGIONAL.Toba.unjuken).toBeUndefined()
    const karoHits = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).filter((k) => k === 'unjuken')
    expect(karoHits.length).toBe(1)
  })

  it('note memuat sumber pertama Singarimbun 1975 untuk makna aset mas kawin', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.unjuken
    expect(e.note).toContain('Singarimbun 1975')
    expect(e.note).toContain('mas kawin')
  })

  it('note memuat judul resmi Singarimbun via OpenLibrary OL1779270W', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.unjuken
    expect(e.note).toContain('Kinship, descent, and alliance among the Karo Batak')
    expect(e.note).toContain('OL1779270W')
  })

  it('note memuat sumber kedua Joustra 1926 lema oendjoek berstatus nice-to-have belum terverifikasi full-text', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.unjuken
    expect(e.note).toContain('Joustra 1926')
    expect(e.note).toContain('oendjoek')
    expect(e.note).toContain('nice-to-have')
    expect(e.note).toContain('belum terverifikasi full-text')
  })

  it('exact-key lookup: kunci unjuken langsung kena di map Karo tanpa resolve', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['unjuken']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.depth).toBe(0)
  })

  it('struktur field konsisten dengan entry Karo lain (batangna): kind depth region note', () => {
    const u = KINSHIP_ALIASES_REGIONAL.Karo.unjuken
    const b = KINSHIP_ALIASES_REGIONAL.Karo.batangna
    expect(Object.keys(u).sort()).toEqual(Object.keys(b).sort())
    expect(Object.keys(u).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })

  it('negatif: alias tak terkait di map utama tidak ikut jadi entri Karo, istilah tak dikenal null', () => {
    const kakanda = resolveAlias('kakanda', 'Karo')
    if (kakanda !== null) {
      expect(kakanda.region).not.toBe('Karo')
      expect(kakanda.kind).not.toBe('property')
    }
    expect(resolveAlias('bukanistilahkekerabatan', 'Karo')).toBeNull()
  })

  it('regresi: batangna Karo dari v196-i tidak tertimpa entri unjuken', () => {
    const r = resolveAlias('batangna', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
    expect(r?.depth).toBe(1)
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('unjuken', 'Karo')
    const b = resolveAlias('unjuken', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.unjuken)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key setelah unjuken masuk (v197-ii add-only)', () => {
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
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual(['amangboru', 'butet', 'iboto', 'ompung suhut', 'pariban'])
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Toba'])
  })
})
