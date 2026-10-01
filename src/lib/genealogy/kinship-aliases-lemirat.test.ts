import { describe, expect, it } from 'vitest'
import { resolveAlias } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases lemirat Karo (v202-i, kind pernikahan, dual-source lintas era)', () => {
  it('1. resolveAlias lemirat region Karo kembalikan kind pernikahan', () => {
    const r = resolveAlias('lemirat', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
  })

  it('2. resolveAlias lemirat region Karo depth 1', () => {
    expect(resolveAlias('lemirat', 'Karo')?.depth).toBe(1)
  })

  it('3. resolveAlias lemirat region Karo region Karo', () => {
    expect(resolveAlias('lemirat', 'Karo')?.region).toBe('Karo')
  })

  it('4. homonim: LEMIRAT huruf besar sama dengan lemirat (normalisasi lowercase)', () => {
    expect(resolveAlias('LEMIRAT', 'Karo')).toEqual(resolveAlias('lemirat', 'Karo'))
    expect(resolveAlias('LEMIRAT', 'Karo')).not.toBeNull()
  })

  it('5. resolveAlias lemirat tanpa region bernilai null: lemirat hanya ada di map regional Karo', () => {
    expect(resolveAlias('lemirat')).toBeNull()
  })

  it('6. resolveAlias lemirat region Toba bernilai null', () => {
    expect(resolveAlias('lemirat', 'Toba')).toBeNull()
  })

  it('7. note memuat jejak sumber 1: van der Tuuk 1861 glosa levirat lengkap tanpa bayar ulang', () => {
    expectNoteContains('Karo', 'lemirat', ['van der Tuuk 1861', 'notes/475', 'tanpa bayar ulang'])
  })

  it('8. note memuat jejak sumber 2: Joustra 1926 monografi adat hlm 32', () => {
    expectNoteContains('Karo', 'lemirat', ['Joustra 1926', 'notes/476'])
  })

  it('9. note menyebut dua sumber lintas era', () => {
    expectNoteContains('Karo', 'lemirat', ['DUA SUMBER lintas era'])
  })

  it('10. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Karo', 'lemirat')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('11. negatif pengunci: istilah afinitas lain (suhut bao kula kalin) tetap tidak terdaftar', () => {
    expect(resolveAlias('suhut')).toBeNull()
    expect(resolveAlias('bao')).toBeNull()
    expect(resolveAlias('kula')).toBeNull()
    expect(resolveAlias('kalin')).toBeNull()
  })

  it('12. kind pernikahan anggota sah union KinshipKind dan label id/en terdaftar (v201-i hidup)', async () => {
    const labels = await import('./kinship-labels')
    // KINSHIP_LABELS bertipe Record<KinshipKind, ...>: indexing dengan literal
    // 'pernikahan' gagal kompilasi (tsc gate) bila union tidak memuatnya.
    expect(Object.keys(labels.KINSHIP_LABELS)).toContain('pernikahan')
    expect(labels.KINSHIP_LABELS['pernikahan'].id.length).toBeGreaterThan(0)
    expect(labels.KINSHIP_LABELS['pernikahan'].en.length).toBeGreaterThan(0)
  })
})
