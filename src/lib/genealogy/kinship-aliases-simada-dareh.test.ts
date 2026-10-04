import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases kalimbubu simada dareh Karo (v232-i, pernikahan depth 1, pemberi wanita jalur ayah)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu simada dareh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
  })

  it('positif: resolveAlias dengan region Karo', () => {
    const r = resolveAlias('kalimbubu simada dareh', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Kalimbubu Simada Dareh', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('KALIMBUBU SIMADA DAREH', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('  kalimbubu  simada  dareh ', 'Karo')?.depth).toBe(1)
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('kalimbubu simada dareh')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('kalimbubu simada dareh', 'Toba')).toBeNull()
    expect(resolveAlias('kalimbubu simada dareh', 'Simalungun')).toBeNull()
  })

  it('negatif: simada polos nihil (homonim)', () => {
    expect(resolveAlias('simada', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['simada']).toBeUndefined()
  })

  it('negatif: dareh polos nihil (homonim)', () => {
    expect(resolveAlias('dareh', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['dareh']).toBeUndefined()
  })

  it('negatif: potongan formula nihil (kalimbubu simada)', () => {
    expect(resolveAlias('kalimbubu simada', 'Karo')).toBeNull()
  })

  it('negatif: reciprocitas, anak beru pengambil tetap entri terpisah (arah pemberi perempuan di simada dareh)', () => {
    const ab = resolveAlias('anak beru', 'Karo')
    expect(ab).not.toBeNull()
    expect(ab?.kind).toBe('pernikahan')
    const note = resolveAlias('kalimbubu simada dareh', 'Karo')?.note ?? ''
    expect(note).toContain('pemberi')
    expect(note).toContain('pengambil tetap anak beru')
  })

  it('evidence: note dual-source memuat DOI Ginting 2017 OSF dan JAMPARING Rambe 2025', () => {
    const note = resolveAlias('kalimbubu simada dareh', 'Karo')?.note ?? ''
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('baris 2095-2096 dan 3212-3213')
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('baris 196')
  })

  it('evidence: verbatim Rambe 2025 only available for women dan frasa pemberi wanita', () => {
    const note = resolveAlias('kalimbubu simada dareh', 'Karo')?.note ?? ''
    expect(note).toContain('only available for women')
    expect(note).toContain('pemberi wanita')
  })

  it('non-regresi: kalimbubu dasar tetap pernikahan depth 1 Karo', () => {
    const r = resolveAlias('kalimbubu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('non-regresi: puang kalimbubu tetap depth 2 (v226-i)', () => {
    expect(resolveAlias('puang kalimbubu', 'Karo')?.depth).toBe(2)
  })

  it('guard: objek Karo naik tepat 28 jadi 29 key, simada dareh sisip alfabetis antara kalimbubu dan singalo bere-bere', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(29) // v232-i bump 28 jadi 29 (alias kalimbubu simada dareh)
    expect(keys).toContain('kalimbubu simada dareh')
    const sorted = [...keys].sort()
    const i = sorted.indexOf('kalimbubu simada dareh')
    expect(sorted[i - 1]).toBe('kalimbubu')
    expect(sorted[i + 1]).toBe('kalimbubu singalo bere-bere')
  })
})
