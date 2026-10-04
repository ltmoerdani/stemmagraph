import { describe, expect, it } from 'vitest'
import {
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases'

describe('kinship-aliases kalimbubu singalo perbibin Karo (v237-i, pernikahan depth 1, EMPAT SUMBER)', () => {
  it('resolve key komposit kanonik kalimbubu singalo perbibin', () => {    const r = resolveAlias('kalimbubu singalo perbibin', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('perbibin polos TIDAK match di luar komposit (negatif homonim)', () => {
    expect(resolveAlias('perbibin', 'Karo')).toBeNull()
  })

  it('singalo perbibin tanpa kalimbubu TIDAK match (komposit wajib lengkap)', () => {
    expect(resolveAlias('singalo perbibin', 'Karo')).toBeNull()
  })

  it('kalimbubu perbibin tanpa singalo TIDAK match', () => {
    expect(resolveAlias('kalimbubu perbibin', 'Karo')).toBeNull()
  })

  it('kalimbubu singalo ulu emas tetap entri TERPISAH, bukan alias perbibin', () => {
    const r = resolveAlias('kalimbubu singalo ulu emas', 'Karo')
    expect(r).not.toBeNull()
    expect(
      KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo ulu emas'],
    ).not.toBe(KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perbibin'])
  })

  it('non-regresi: singalo bere-bere dan singalo perkempun tetap resolve entri lama depth 2', () => {
    const r1 = resolveAlias('kalimbubu singalo bere-bere', 'Karo')
    expect(r1).not.toBeNull()
    expect(r1?.kind).toBe('pernikahan')
    expect(r1?.depth).toBe(2)
    const r2 = resolveAlias('kalimbubu singalo perkempun', 'Karo')
    expect(r2).not.toBeNull()
    expect(r2?.kind).toBe('pernikahan')
    expect(r2?.depth).toBe(2)
  })

  it('guard posisi alfabetis: perbibin sisip antara bere-bere dan perkempun', () => {
    const sorted = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    const i = sorted.indexOf('kalimbubu singalo perbibin')
    expect(sorted[i - 1]).toBe('kalimbubu singalo bere-bere')
    expect(sorted[i + 1]).toBe('kalimbubu singalo perkempun')
  })

  it('guard: objek Karo naik tepat 33 jadi 34 key, tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(34) // v237-i bump 33 jadi 34 (alias kalimbubu singalo perbibin); v236-i bump 32 jadi 33 (singalo ulu emas); v235-i bump 31 jadi 32 (anak beru menteri); v234-i bump 30 jadi 31 (puang ni puang)
  })
})
