import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key akong (v253xxvii gelombang sembilan, test-only).
 * Sumber entri: KBBI VI resmi a.kong n Hokkien kakek (akses 13 Okt 2026)
 * plus Wiktionary EN oldid 91156570 blok Amis dan Kangean grandfather
 * etimologi Hokkien a-kong, dan sinonim akong di blok Bahasa Indonesia
 * Peranakan entri engkong Wiktionary ID oldid 1459478. Entri live ada di
 * kinship-aliases.ts; test ini mengunci kontrak gugus grandparent regional
 * Sinitic dan guard anti penempatan salah kind.
 */
describe('kinship-aliases akong (v253xxvii)', () => {
  it('1. entri akong live: kind grandparent, qualifier hokkien, region Tionghoa', () => {
    const e = KINSHIP_ALIASES['akong']
    expect(e).toBeDefined()
    expect(e.kind).toBe('grandparent')
    expect(e.qualifier).toBe('hokkien')
    expect(e.region).toBe('Tionghoa')
  })

  it('2. resolveAlias akong non-null dan kind grandparent', () => {
    const r = resolveAlias('akong')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
  })

  it('3. varian kapitalisasi resolve identik', () => {
    expect(resolveAlias('Akong')?.kind).toBe('grandparent')
    expect(resolveAlias('AKONG')?.kind).toBe('grandparent')
  })

  it('4. gugus grandparent regional Sinitic konsisten: akong dan engkong sama-sama Tionghoa dengan qualifier berbeda', () => {
    expect(KINSHIP_ALIASES['engkong']?.qualifier).toBe('cn')
    expect(KINSHIP_ALIASES['engkong']?.region).toBe('Tionghoa')
    expect(KINSHIP_ALIASES['akong']?.qualifier).toBe('hokkien')
    expect(KINSHIP_ALIASES['akong']?.region).toBe('Tionghoa')
  })

  it('5. guard homonim dicatat jujur di note: Rejang kelenteng dan Chungli Ao verba tidak dipetakan', () => {
    const note = KINSHIP_ALIASES['akong'].note
    expect(note).toContain('Rejang')
    expect(note).toContain('kelenteng')
    expect(note).toContain('Chungli Ao')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('6. note sumber lengkap: KBBI VI plus Wiktionary EN oldid 91156570 dan sinonim blok Peranakan', () => {
    const note = KINSHIP_ALIASES['akong'].note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('kakek')
    expect(note).toContain('91156570')
    expect(note).toContain('1459478')
    expect(note).toContain('a-kong')
  })

  it('7. tidak bocor ke kind lain dan tetap satu key', () => {
    expect(aliasKinds().filter((k) => k === 'akong')).toHaveLength(1)
    const gp = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'grandparent')
    expect(gp).toContain('akong')
    const props = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'property')
    expect(props).not.toContain('akong')
  })

  it('8. guard jumlah key PERSIS 114 pasca v253xxvii gelombang sembilan (113 jadi 114: akong)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(123)
    expect(aliasKinds().length).toBe(123)
  })

  it('9. non-regresi gugus grandparent inti: kakek nenek engkong embah tetap live', () => {
    for (const k of ['kakek', 'nenek', 'engkong', 'embah', 'eyang']) {
      expect(KINSHIP_ALIASES[k]?.kind).toBe('grandparent')
      expect(resolveAlias(k)).not.toBeNull()
    }
  })
})
