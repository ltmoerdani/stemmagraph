import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

// Evidence DOI:
// Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 2123 dan 2145
//   (si ngalo ulu emas, saudara laki-laki ibu; Luah Kalimbubu singalo ulu emas)
// Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 214
//   (Kalimbubu Singalo Ulu Emas, sierkimbang bapa si empo atau simupus si empo)
// Tarigan 2019 EUDL NICCT DOI 10.4108/eai.20-9-2019.2296621 baris 81
//   (kalimbubu si ngalo ulu emas means the brother of mother's groom)
describe('kinship-aliases kalimbubu singalo ulu emas Karo (v236-i, komposit kalimbubu fase iii, pernikahan depth 1)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo ulu emas']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
  })

  it('note memuat makna sierkimbang bapa, tiga DOI, dan variasi ejaan', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo ulu emas'].note
    expect(note.startsWith('kalimbubu singalo ulu emas Karo')).toBe(true)
    expect(note).toContain('sierkimbang bapa si empo')
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('10.4108/eai.20-9-2019.2296621')
    expect(note).toContain('si ngalo ulu emas')
  })

  it('positif: resolveAlias region Karo kind pernikahan depth 1', () => {
    const r = resolveAlias('kalimbubu singalo ulu emas', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Kalimbubu Singalo Ulu Emas', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('KALIMBUBU SINGALO ULU EMAS', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('  kalimbubu  singalo  ulu  emas ', 'Karo')?.depth).toBe(1)
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('kalimbubu singalo ulu emas')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('kalimbubu singalo ulu emas', 'Toba')).toBeNull()
    expect(resolveAlias('kalimbubu singalo ulu emas', 'Simalungun')).toBeNull()
  })

  it('negatif: ulu emas polos nihil, homonim fragmen bukan key', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['ulu emas']).toBeUndefined()
    expect(resolveAlias('ulu emas', 'Karo')).toBeNull()
  })

  it('negatif: singalo ulu polos nihil, komposit empat kata wajib utuh', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['singalo ulu']).toBeUndefined()
    expect(resolveAlias('singalo ulu', 'Karo')).toBeNull()
  })

  it('negatif: variasi ejaan si ngalo ulu emas nihil sebagai key, kanonik saja', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['si ngalo ulu emas']).toBeUndefined()
    expect(resolveAlias('si ngalo ulu emas', 'Karo')).toBeNull()
  })

  it('non-regresi: kalimbubu dasar tetap pernikahan depth 1', () => {
    const r = resolveAlias('kalimbubu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo ulu emas']).not.toBe(
      KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu'],
    )
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

  it('guard posisi alfabetis: sisip alfabetis antara singalo perkempun dan siperdemui', () => {
    const sorted = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    const i = sorted.indexOf('kalimbubu singalo ulu emas')
    expect(sorted[i - 1]).toBe('kalimbubu singalo perkempun')
    expect(sorted[i + 1]).toBe('kalimbubu siperdemui')
  })

  it('guard: objek Karo naik tepat 33 jadi 34 key, tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(34) // v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas); v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang)
  })
})
