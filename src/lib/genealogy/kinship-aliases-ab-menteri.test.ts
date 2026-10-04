import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

// Evidence DOI:
// Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 1403
//   (Anak Beru dari Anak Beru) dan baris 1407-1410 (dukungan dan pemberi saran dalam landan)
// Charismo Habeahan baris 80 (tutur siwaluh: Kalimbubu, Puang Kalimbubu, Puang ni puang,
//   Senina, Sembuyak, anak beru, anak beru menteri, anak beru singukuri)
describe('kinship-aliases anak beru menteri Karo (v235-i, komposit anak beru fase ii, pernikahan depth 1)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['anak beru menteri']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
  })

  it('positif: resolveAlias region Karo kind pernikahan depth 1', () => {
    const r = resolveAlias('anak beru menteri', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Anak Beru Menteri', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('ANAK BERU MENTERI', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('  anak  beru  menteri ', 'Karo')?.depth).toBe(1)
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('anak beru menteri')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('anak beru menteri', 'Toba')).toBeNull()
    expect(resolveAlias('anak beru menteri', 'Simalungun')).toBeNull()
  })

  it('negatif: menteri polos nihil, komposit empat kata wajib utuh', () => {
    expect(resolveAlias('menteri', 'Karo')).toBeNull()
  })

  it('negatif: anak beru polos tetap cocok entri existing anak beru (pernikahan depth 1)', () => {
    const r = resolveAlias('anak beru', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.note.startsWith('anak beru Karo')).toBe(true)
  })

  it('negatif: anak beru singukuri nihil, single-source DITAHAN belum boleh jadi key', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['anak beru singukuri']).toBeUndefined()
    expect(resolveAlias('anak beru singukuri', 'Karo')).toBeNull()
  })

  it('anti-bentrok v227-i: komponen formula metami man anak beru tetap nihil sebagai key', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metami man anak beru']).toBeUndefined()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
  })

  it('non-regresi: key anak beru dasar tidak bergeser, entri menteri terpisah', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['anak beru']).toBeDefined()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['anak beru'].depth).toBe(1)
    expect(KINSHIP_ALIASES_REGIONAL.Karo['anak beru menteri']).not.toBe(
      KINSHIP_ALIASES_REGIONAL.Karo['anak beru'],
    )
  })

  it('guard posisi alfabetis: sisip alfabetis antara anak beru dan bapa nguda', () => {
    const sorted = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    const i = sorted.indexOf('anak beru menteri')
    expect(sorted[i - 1]).toBe('anak beru')
    expect(sorted[i + 1]).toBe('bapa nguda')
  })

  it('guard: objek Karo naik tepat 31 jadi 32 key, tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(33) // v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang)
  })
})
