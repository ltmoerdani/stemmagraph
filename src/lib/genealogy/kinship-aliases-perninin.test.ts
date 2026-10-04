import { describe, expect, it } from 'vitest'
import {
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases'

// Evidence quad-source v238-i:
// karokab.blogspot.com 'Pengalon Pada Perkawinan Adat Suku Karo' 10 Agu 2022
//   verbatim "Yang ke empat adalah Pengalon Perninin. Pengalon perninin ini
//   besarnya setengah dari pengalon perkempun. Yang menerima adalah kalimbubu
//   singalo perninin."
// karogaul.com Des 2023 Juara R Ginting verbatim "Singalo Perkempun (B) adalah
//   ibu dari nomor 2 dan nomor 4. Sementara Singalo Perninin (A) adalah ibu
//   dari nomor 1 dan nomor 3."
// pemudamergasilima.id 3 Jul 2023 (Buku Mutiara Hijau Budaya Karo 2012, ed.
//   Sarjani Tarigan) verbatim "Perninin: ialah bagian mas kawin yang diserahkan
//   kepada serupa dengan nomor 8."
// Taushiah UISU 12(2) 2022 DOI 10.30743/taushiah.v12i2.6370 dua verbatim
//   "Kalimbubu Singalo Perninin" (daftar golongan adat pihak perempuan)
describe('kinship-aliases kalimbubu singalo perninin Karo (v238-i, pernikahan depth 2, EMPAT SUMBER)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perninin']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(2)
    expect(e.region).toBe('Karo')
  })

  it('positif: resolveAlias key komposit kanonik, kind pernikahan depth 2', () => {
    const r = resolveAlias('kalimbubu singalo perninin', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
  })

  it('positif: normalisasi kapital dan spasi ganda', () => {
    expect(resolveAlias('Kalimbubu Singalo Perninin', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('KALIMBUBU SINGALO PERNININ', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('  kalimbubu  singalo  perninin ', 'Karo')?.depth).toBe(2)
  })

  it('note memuat evidence quad-source lengkap', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perninin'].note
    expect(note).toContain('karokab.blogspot.com')
    expect(note).toContain('karogaul.com')
    expect(note).toContain('pemudamergasilima.id')
    expect(note).toContain('Taushiah')
    expect(note).toContain('10.30743/taushiah.v12i2.6370')
  })

  it('note memuat catatan disparitas penempatan pihak antar sumber', () => {
    const note = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perninin'].note
    expect(note).toContain('DISPARITAS')
    expect(note).toContain('pengantin perempuan')
    expect(note).toContain('tanpa hardcode region')
  })

  it('negatif homonim: perninin polos (makna bagian mas kawin) TIDAK match', () => {
    expect(resolveAlias('perninin', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['perninin']).toBeUndefined()
  })

  it('negatif komposit parsial: singalo perninin tanpa kalimbubu TIDAK match', () => {
    expect(resolveAlias('singalo perninin', 'Karo')).toBeNull()
  })

  it('negatif komposit parsial: kalimbubu perninin tanpa singalo TIDAK match', () => {
    expect(resolveAlias('kalimbubu perninin', 'Karo')).toBeNull()
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('kalimbubu singalo perninin')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('kalimbubu singalo perninin', 'Toba')).toBeNull()
    expect(resolveAlias('kalimbubu singalo perninin', 'Simalungun')).toBeNull()
  })

  it('non-bentrok: kalimbubu singalo perkempun tetap entri lama terpisah (pola puang ni puang vs puang polos)', () => {
    const r = resolveAlias('kalimbubu singalo perkempun', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
    expect(
      KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perkempun'],
    ).not.toBe(KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perninin'])
  })

  it('non-bentrok: perbibin v237-i tetap depth 1 dan objek terpisah', () => {
    const r = resolveAlias('kalimbubu singalo perbibin', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.depth).toBe(1)
    expect(
      KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perbibin'],
    ).not.toBe(KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu singalo perninin'])
  })

  it('non-bentrok: negatif reciprocity v227-i tetap nihil (metenget ersenina, metami man anak beru)', () => {
    expect(resolveAlias('metenget ersenina', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metenget ersenina']).toBeUndefined()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metami man anak beru']).toBeUndefined()
  })

  it('non-bentrok: puang ni puang v234-i tetap entri sendiri, puang polos tetap nihil', () => {
    const r = resolveAlias('puang ni puang', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
    expect(resolveAlias('puang', 'Karo')).toBeNull()
  })

  it('guard posisi alfabetis: perninin sisip antara perkempun dan ulu emas', () => {
    const sorted = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    const i = sorted.indexOf('kalimbubu singalo perninin')
    expect(i).toBeGreaterThan(-1)
    expect(sorted[i - 1]).toBe('kalimbubu singalo perkempun')
    expect(sorted[i + 1]).toBe('kalimbubu singalo ulu emas')
  })

  it('guard: objek Karo naik tepat 34 jadi 35 key, tanpa duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(35) // v238-i bump 34 jadi 35 (alias kalimbubu singalo perninin); v237-i bump 33 jadi 34 (alias kalimbubu singalo perbibin); v236-i bump 32 jadi 33 (singalo ulu emas); v235-i bump 31 jadi 32 (anak beru menteri); v234-i bump 30 jadi 31 (puang ni puang)
  })
})
