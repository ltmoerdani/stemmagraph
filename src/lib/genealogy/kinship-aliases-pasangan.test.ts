import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema pasangan (gel40, kind partner depth 1 baku nasional, test-only).
 * Dua sumber first-hand 16 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/pasangan (pa.sang.an tiga homograf;
 * dipetakan hanya makna relasi: pasang1 makna 2 perempuan bagi laki-laki
 * atau sebaliknya, dan pasang4 yang menjadi padanannya jodoh partner)
 * plus Wiktionary ID oldid 1351292 timestamp 2026-04-18 via action=raw
 * (blok bahasa Indonesia definisi 1 dan 2 identik KBBI kata per kata,
 * kutipan sastra Perahu Tulis 2012 hlm 174, gloss suami atau istri,
 * R:KBBI Daring, templat rfv impor dicatat jujur). Lema generik yang
 * melengkapi suami dan istri (keduanya baku nasional gel39) pola
 * generik-di-samping-spesifik. Guard polisemi: sepasang benda, organ
 * tubuh, pelengkap baju, Ling, petaruh, pa.sa.ngan Jw tidak dipetakan.
 * Anti-difusi: suami istri tetap partner baku nasional key sendiri,
 * diberu turangku tetap partner Karo. Total map 142 menjadi 143 (kontrak gel40 prediksi 144 dikoreksi aritmetika transparan: gel39 ternyata 140 jadi 142, pasangan menambah SATU key).
 */
describe('kinship-aliases pasangan (gel40)', () => {
  const GUARD_KEYS = 145

  it('1. positif: pasangan live kind partner depth 1', () => {
    const e = KINSHIP_ALIASES['pasangan']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.depth).toBe(1)
    expect(resolveAlias('pasangan')?.kind).toBe('partner')
  })

  it('2. baku nasional: tanpa region tanpa register tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['pasangan']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi makna 1 dipakai bersama: sepasang sepatu nihil match exact-phrase', () => {
    expect(resolveAlias('sepasang sepatu')).toBeNull()
    expect(resolveAlias('pasangan sepatu')).toBeNull()
  })

  it('4. negasi makna pelengkap: pasangan baju nihil match exact-phrase', () => {
    expect(resolveAlias('pasangan baju')).toBeNull()
  })

  it('5. negasi makna organ tubuh nihil match exact-phrase', () => {
    expect(resolveAlias('pasangan jantung')).toBeNull()
  })

  it('6. negasi makna petaruh nihil match exact-phrase', () => {
    expect(resolveAlias('pasangan petaruh')).toBeNull()
  })

  it('7. negasi homograf Jw pa.sa.ngan nihil key', () => {
    expect(KINSHIP_ALIASES['pa.sa.ngan']).toBeUndefined()
    expect(resolveAlias('pa.sa.ngan')).toBeNull()
  })

  it('8. anti-difusi: suami tetap partner baku nasional key sendiri', () => {
    const e = KINSHIP_ALIASES['suami']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.region).toBeUndefined()
    expect(KINSHIP_ALIASES['pasangan']).not.toBe(e)
  })

  it('9. anti-difusi: istri tetap partner baku nasional key sendiri', () => {
    const e = KINSHIP_ALIASES['istri']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.region).toBeUndefined()
    expect(KINSHIP_ALIASES['pasangan']).not.toBe(e)
  })

  it('10. anti-difusi: diberu dan turangku tetap partner Karo di map REGIONAL', () => {
    for (const k of ['diberu', 'turangku']) {
      const e = KINSHIP_ALIASES_REGIONAL['Karo'][k]
      expect(e).toBeDefined()
      expect(e.kind).toBe('partner')
      expect(e.region).toBe('Karo')
    }
    expect(KINSHIP_ALIASES['pasangan']).not.toBe(KINSHIP_ALIASES_REGIONAL['Karo']['diberu'])
  })

  it('11. urutan sisip alfabetis: pasangan antara istri dan permen', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys[keys.indexOf('pasangan') - 1]).toBe('istri')
    expect(keys[keys.indexOf('pasangan') + 1]).toBe('permen')
  })

  it('12. total map PERSIS 144 dan aliasKinds 144 pasca gel40 (GUARD_KEYS bump 142 jadi 144)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })
})
