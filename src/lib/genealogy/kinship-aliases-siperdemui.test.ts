import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

// Evidence DOI:
// Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 2098 dan 3213-3214
//   (siperdemui paman berdasarkan kekerabatan dari pihak perempuan yang dinikahi)
// Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 198-199
//   (all kalimbubu by marriage of the sukut, sembuyak and senina)
describe('kinship-aliases kalimbubu siperdemui Karo (v233-i, pernikahan depth 1, kalimbubu pernikahan dari sukut sembuyak senina)', () => {
  it('entri terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['kalimbubu siperdemui']
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
  })

  it('positif: resolveAlias dengan region Karo, kind pernikahan depth 1', () => {
    const r = resolveAlias('kalimbubu siperdemui', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
  })

  it('positif: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Kalimbubu Siperdemui', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('KALIMBUBU SIPERDEMUI', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('  kalimbubu  siperdemui ', 'Karo')?.depth).toBe(1)
  })

  it('negatif: tanpa region nihil (map regional)', () => {
    expect(resolveAlias('kalimbubu siperdemui')).toBeNull()
  })

  it('negatif: region lain nihil', () => {
    expect(resolveAlias('kalimbubu siperdemui', 'Toba')).toBeNull()
    expect(resolveAlias('kalimbubu siperdemui', 'Simalungun')).toBeNull()
  })

  it('negatif: pedemui polos nihil (homonim, hanya muncul dalam komposit siperdemui)', () => {
    expect(resolveAlias('pedemui', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['pedemui']).toBeUndefined()
  })

  it('negatif: si er polos nihil (homonim, Si Er Pedemui hanya varian ejaan di note)', () => {
    expect(resolveAlias('si er', 'Karo')).toBeNull()
    expect(resolveAlias('si er pedemui', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['si er']).toBeUndefined()
  })

  it('negatif: erkimbang polos nihil, entri terpisah sengaja tidak dibuat (disparitas Ginting vs JAMPARING)', () => {
    expect(resolveAlias('erkimbang', 'Karo')).toBeNull()
    expect(resolveAlias('sierkimbang', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['erkimbang']).toBeUndefined()
  })

  it('negatif: potongan formula nihil (kalimbubu siper)', () => {
    expect(resolveAlias('kalimbubu siper', 'Karo')).toBeNull()
  })

  it('disparitas: note memuat penyebutan Ginting menyamakan Si Er Pedemui dengan si Erkimbang dan sikap entri erkimbang tidak dibuat', () => {
    const note = resolveAlias('kalimbubu siperdemui', 'Karo')?.note ?? ''
    expect(note).toContain('Si Er Pedemui')
    expect(note).toContain('Erkimbang')
    expect(note).toContain('entri erkimbang terpisah sengaja tidak dibuat')
  })

  it('evidence: note dual-source memuat DOI Ginting 2017 OSF dan JAMPARING Rambe 2025', () => {
    const note = resolveAlias('kalimbubu siperdemui', 'Karo')?.note ?? ''
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('baris 2098 dan 3213-3214')
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('baris 198-199')
  })

  it('evidence: verbatim JAMPARING all kalimbubu by marriage of the sukut sembuyak and senina', () => {
    const note = resolveAlias('kalimbubu siperdemui', 'Karo')?.note ?? ''
    expect(note).toContain('sukut, sembuyak, dan senina')
    expect(note).toContain('pihak perempuan yang dinikahi')
  })

  it('non-regresi: struktur alias Karo tetap utuh, kalimbubu dasar pernikahan depth 1', () => {
    const r = resolveAlias('kalimbubu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('kalimbubu simada dareh', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('puang kalimbubu', 'Karo')?.depth).toBe(2)
  })

  it('guard: objek Karo naik tepat 29 jadi 30 key, siperdemui sisip alfabetis antara singalo perkempun dan puang kalimbubu', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(30) // v233-i bump 29 jadi 30 (alias kalimbubu siperdemui)
    expect(keys).toContain('kalimbubu siperdemui')
    const sorted = [...keys].sort()
    const i = sorted.indexOf('kalimbubu siperdemui')
    expect(sorted[i - 1]).toBe('kalimbubu singalo perkempun')
    expect(sorted[i + 1]).toBe('puang kalimbubu')
  })
})
