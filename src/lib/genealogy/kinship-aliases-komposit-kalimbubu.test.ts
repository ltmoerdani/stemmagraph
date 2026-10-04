import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

const KEYS = ['kalimbubu singalo bere-bere', 'kalimbubu singalo perkempun', 'puang kalimbubu'] as const

describe('kinship-aliases komposit kalimbubu Karo (v226-i, pernikahan depth 2)', () => {
  it.each(KEYS)('%s terdaftar di blok Karo dengan empat field lengkap', (key) => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo[key]
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(2)
    expect(e.region).toBe('Karo')
    expect((e.note ?? '').length).toBeGreaterThan(50)
  })

  it.each(KEYS)('%s resolve penuh lewat resolveAlias region Karo', (key) => {
    const e = resolveAlias(key, 'Karo')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(2)
  })

  it('normalisasi huruf besar dan spasi ganda tetap resolve', () => {
    expect(resolveAlias('  Puang  Kalimbubu ', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('KALIMBUBU SINGALO PERKEMPUN', 'Karo')?.depth).toBe(2)
  })

  it('note singalo bere-bere memuat DOI Ginting, DOI Wahyuni, dan korpus', () => {
    const note = resolveAlias('kalimbubu singalo bere-bere', 'Karo')?.note ?? ''
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('10.24114/ph.v8i2.47936')
    expect(note).toContain('notes/oa/oa1-unimed.txt')
    expect(note).toContain('882')
  })

  it('note singalo perkempun memuat DOI Ginting, DOI Wahyuni, dan baris korpus', () => {
    const note = resolveAlias('kalimbubu singalo perkempun', 'Karo')?.note ?? ''
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('10.24114/ph.v8i2.47936')
    expect(note).toContain('1503-1508')
  })

  it('note puang kalimbubu memuat hdl Woollams, DOI Ginting, DOI Wahyuni, dan kutipan verbatim', () => {
    const note = resolveAlias('puang kalimbubu', 'Karo')?.note ?? ''
    expect(note).toContain('1885/145878')
    expect(note).toContain('11015-11016')
    expect(note).toContain('the kalimbubu of the kalimbubu')
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('10.24114/ph.v8i2.47936')
  })

  it('negatif homonim: singalo polos nihil, dengan maupun tanpa region', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.singalo).toBeUndefined()
    expect(resolveAlias('singalo', 'Karo')).toBeNull()
    expect(resolveAlias('singalo')).toBeNull()
  })

  it('negatif: kalimbubu singalo tanpa ekor nihil', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo']).toBeUndefined()
    expect(resolveAlias('kalimbubu singalo', 'Karo')).toBeNull()
  })

  it('negatif: ekor tanpa kalimbubu (bere-bere, perkempun polos) nihil', () => {
    expect(resolveAlias('bere-bere', 'Karo')).toBeNull()
    expect(resolveAlias('perkempun', 'Karo')).toBeNull()
  })

  it('komposit tidak bocor ke peta utama dan wilayah lain', () => {
    for (const key of KEYS) {
      expect(KINSHIP_ALIASES[key]).toBeUndefined()
      expect(resolveAlias(key)).toBeNull()
      expect(resolveAlias(key, 'Toba')).toBeNull()
    }
  })

  it('non-regresi: kalimbubu tetap pernikahan depth 1 Karo', () => {
    const e = resolveAlias('kalimbubu', 'Karo')
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('non-regresi: anak beru tetap pernikahan depth 1 Karo', () => {
    const e = resolveAlias('anak beru', 'Karo')
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('guard jumlah key Karo menjadi 26', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).length).toBe(34) // v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang); v232-i bump 28 jadi 29 (alias kalimbubu simada dareh) (alias kalimbubu siperdemui)
  })
})
