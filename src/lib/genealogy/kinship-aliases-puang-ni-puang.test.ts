import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

// Evidence DOI:
// Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 188
//   (Kalimbubu of Puang Kalimbubu) dan baris 184 (tiers Kalimbubu, Puang Kalimbubu, Puang Ni Puang)
// Charismo Habeahan baris 78-80 (tutur siwaluh: Kalimbubu, Puang Kalimbubu, Puang ni puang,
//   Senina, Sembuyak, anak beru, anak beru menteri, anak beru singukuri)
// Tarigan 2020 EUDL DOI 10.4108/eai.20-9-2019.2296621 baris 80-88
//   (puang ni puang means the kalimbubu of puang kalimbubu of groom's family)
describe('kinship-aliases puang ni puang Karo (v234-i, pernikahan depth 2, kalimbubu dari puang kalimbubu)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['puang ni puang']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(2)
    expect(e.region).toBe('Karo')
  })

  it('positif: resolveAlias dengan region Karo, kind pernikahan depth 2', () => {
    const r = resolveAlias('puang ni puang', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Puang Ni Puang', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('PUANG NI PUANG', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('  puang  ni  puang ', 'Karo')?.depth).toBe(2)
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('puang ni puang')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('puang ni puang', 'Toba')).toBeNull()
    expect(resolveAlias('puang ni puang', 'Simalungun')).toBeNull()
  })

  it('negatif: puang polos nihil, tidak ada key puang di map Karo maupun global (homonim)', () => {
    expect(resolveAlias('puang', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['puang']).toBeUndefined()
    expect(KINSHIP_ALIASES['puang']).toBeUndefined()
  })

  it('negatif: puang kalimbubu tetap cocok entri lama v226-i, bukan entri baru v234-i', () => {
    const r = resolveAlias('puang kalimbubu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(2)
    expect(r?.note).toContain('kalimbubu dari kalimbubu')
    expect(r?.note).toContain('v226-i')
    expect(r?.note).not.toContain('tier ketiga')
  })

  it('negatif: ni polos nihil (homonim, ni hanya penghubung dalam komposit)', () => {
    expect(resolveAlias('ni', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['ni']).toBeUndefined()
  })

  it('negatif: potongan formula nihil (puang ni)', () => {
    expect(resolveAlias('puang ni', 'Karo')).toBeNull()
  })

  it('anti-bentrok v227-i: komponen metenget ersenina dan metami man anak beru tetap tidak terdaftar, mehamat man kalimbubu utuh', () => {
    expect(resolveAlias('metenget ersenina', 'Karo')).toBeNull()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
    expect(resolveAlias('metenget', 'Karo')).toBeNull()
    expect(resolveAlias('metami', 'Karo')).toBeNull()
    const m = resolveAlias('mehamat man kalimbubu', 'Karo')
    expect(m).not.toBeNull()
    expect(m?.depth).toBe(2)
    expect(m?.note).toContain('tidak didaftarkan')
  })

  it('evidence: note tri-source memuat DOI JAMPARING 2025 dan Tarigan 2020 EUDL beserta baris rujukan', () => {
    const note = resolveAlias('puang ni puang', 'Karo')?.note ?? ''
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('baris 188')
    expect(note).toContain('baris 184')
    expect(note).toContain('10.4108/eai.20-9-2019.2296621')
    expect(note).toContain('baris 80-88')
  })

  it('evidence: verbatim JAMPARING kalimbubu of puang kalimbubu, tutur siwaluh Habeahan, dan Tarigan groom family', () => {
    const note = resolveAlias('puang ni puang', 'Karo')?.note ?? ''
    expect(note).toContain('Kalimbubu of Puang Kalimbubu')
    expect(note).toContain('tutur siwaluh')
    expect(note).toContain('the kalimbubu of puang kalimbubu')
    expect(note).toContain("groom's family")
  })

  it('non-regresi: alias Karo lama tetap utuh, depth tidak bergeser', () => {
    expect(resolveAlias('kalimbubu', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('anak beru', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('kalimbubu simada dareh', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('kalimbubu siperdemui', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('kalimbubu singalo bere-bere', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('puang kalimbubu', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('mehamat man kalimbubu', 'Karo')?.depth).toBe(2)
  })

  it('guard: objek Karo naik tepat 30 jadi 31 key, puang ni puang sisip alfabetis antara puang kalimbubu dan sepemeren', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(33) // v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang)
    expect(keys).toContain('puang ni puang')
    const sorted = [...keys].sort()
    const i = sorted.indexOf('puang ni puang')
    expect(sorted[i - 1]).toBe('puang kalimbubu')
    expect(sorted[i + 1]).toBe('sepemeren')
  })
})
