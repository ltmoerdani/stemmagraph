import { describe, expect, it } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases'

// Evidence tri-source v239-i:
// pemudamergasilima.id 3 Jul 2023 (Buku Mutiara Hijau Budaya Karo 2012, ed.
//   Sarjani Tarigan) verbatim "Perkembaren: ialah bagian mas kawin yang
//   diserahkan kepada anak beru dari keluarga ayah pengantin perempuan."
// Taushiah UISU 12(2) 2022 DOI 10.30743/taushiah.v12i2.6370: Sirembah Kulau
//   dan Perkembaren setara bibi dari ayah / turang ayah (sisi ayah)
// Language Literacy UISU 6(2) 2022 DOI 10.30743/ll.v6i2.5974 Sample 10:
//   perkembaren = a part of dowry given to anak beru
// Disparitas penempatan dicatat jujur di note entri: PMS bagian mas kawin,
// Taushiah istilah kekerabatan; entri mengikuti PMS (mas kawin, sirembah kulau).
// Konteks positif dipetakan kind pernikahan pada konteks adat kawin Karo.
describe('kinship-aliases perkembaren Karo (v239-i, pernikahan depth 1, TIGA SUMBER)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['perkembaren']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
  })

  it('positif konteks adat kawin: resolveAlias perkembaren Karo, kind pernikahan depth 1', () => {
    const r = resolveAlias('perkembaren', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Perkembaren', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('PERKEMBAREN', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('  perkembaren  ', 'Karo')?.kind).toBe('pernikahan')
  })

  it('negatif: lemma polos tanpa region TIDAK match', () => {
    expect(resolveAlias('perkembaren')).toBeNull()
  })

  it('negatif: lemma polos di region lain TIDAK match', () => {
    expect(resolveAlias('perkembaren', 'Toba')).toBeNull()
    expect(resolveAlias('perkembaren', 'Simalungun')).toBeNull()
  })

  it('negatif: map utama KINSHIP_ALIASES tidak mendaftarkan perkembaren', () => {
    expect(KINSHIP_ALIASES['perkembaren']).toBeUndefined()
  })

  it('note entri memuat evidence DOI Taushiah dan Language Literacy', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo['perkembaren'].note
    expect(note).toContain('10.30743/taushiah.v12i2.6370')
    expect(note).toContain('10.30743/ll.v6i2.5974')
    expect(note).toContain('pemudamergasilima.id')
    expect(note).toContain('DISPARITAS')
  })

  it('posisi alfabetis: perkembaren di antara pak uda dan puang kalimbubu', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    const i = keys.indexOf('perkembaren')
    expect(i).toBeGreaterThan(keys.indexOf('pak uda'))
    expect(i).toBeLessThan(keys.indexOf('puang kalimbubu'))
  })

  it('anti-bentrok: puang ni puang tetap pernikahan depth 2', () => {
    const r = resolveAlias('puang ni puang', 'Karo')
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
  })

  it('anti-bentrok: kalimbubu singalo bere-bere tetap pernikahan depth 2', () => {
    const r = resolveAlias('kalimbubu singalo bere-bere', 'Karo')
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
  })

  it('anti-bentrok: kalimbubu singalo perkempun dan perninin tetap pernikahan depth 2', () => {
    expect(resolveAlias('kalimbubu singalo perkempun', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('kalimbubu singalo perninin', 'Karo')?.depth).toBe(2)
  })

  it('anti-bentrok: kalimbubu singalo perbibin tetap pernikahan depth 1', () => {
    const r = resolveAlias('kalimbubu singalo perbibin', 'Karo')
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('anti-bentrok: formula komposit metenget dan metami tetap tidak terdaftar', () => {
    expect(resolveAlias('metenget ersenina', 'Karo')).toBeNull()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
  })
})
