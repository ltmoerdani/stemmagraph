import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'
import { expandAliasQuery } from './search-filter'

/**
 * v253-xi: amak (ibu Minangkabau, kind parent depth 1, dua sumber, kontrak PM
 * v253-xi AMAK plus koreksi resmi PM qualifier mk menjadi minangkabau konsisten
 * pola live bako mamak etek). Entri masuk map GLOBAL dengan region Minangkabau,
 * pola mamak v253-vii; blok KINSHIP_ALIASES_REGIONAL.Minangkabau tidak dibuat.
 * Total key global naik PERSIS 1 (87 jadi 88).
 */
describe('kinship-aliases amak (v253-xi, parent depth 1 Minangkabau)', () => {
  it('1. entri live: amak di map global, kind parent, depth 1, qualifier minangkabau, region Minangkabau', () => {
    const e = KINSHIP_ALIASES['amak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('minangkabau')
    expect(e.region).toBe('Minangkabau')
  })

  it('2. resolveAlias amak positif, dengan region Minangkabau sama arah', () => {
    const r = resolveAlias('amak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
    const rr = resolveAlias('amak', 'Minangkabau')
    expect(rr?.kind).toBe('parent')
    expect(rr?.region).toBe('Minangkabau')
  })

  it('3. guard homograf KBBI a.mak2 alat perahu TIDAK dipetakan, amak tetap parent', () => {
    expect(KINSHIP_ALIASES['a.mak2']).toBeUndefined()
    expect(resolveAlias('a.mak2')).toBeNull()
    expect(resolveAlias('amak')?.kind).toBe('parent')
  })

  it('4. kinshipAliasPhrase id dan en untuk key baru: orang tua depth 1', () => {
    expect(kinshipAliasPhrase('amak', 'id')).toBe('orang tua (1 generasi)')
    expect(kinshipAliasPhrase('amak', 'en')).toBe('parent (1 generations)')
  })

  it('5. expandAliasQuery dari search-filter memuat amak', () => {
    const ex = expandAliasQuery('amak')
    expect(ex).toContain('amak')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('6. note memuat frasa alat perahu dan penanda dua sumber', () => {
    const note = resolveAlias('amak')?.note ?? ''
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/amak')
    expect(note).toContain('1471283')
    expect(note).toContain('alat perahu')
    expect(note).toContain('a.mak2')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('7. non-regresi tetangga gugus Minangkabau: mamak bako etek kind dan qualifier tetap', () => {
    expect(resolveAlias('mamak')?.kind).toBe('parent-sibling')
    expect(resolveAlias('bako')?.kind).toBe('parent-sibling')
    expect(resolveAlias('etek')?.kind).toBe('parent-sibling')
    expect(KINSHIP_ALIASES['mamak']?.qualifier).toBe('minangkabau')
    expect(KINSHIP_ALIASES['bako']?.qualifier).toBe('minangkabau')
    expect(KINSHIP_ALIASES['etek']?.qualifier).toBe('minangkabau')
  })

  it('8. guard bump total key: Object.keys(KINSHIP_ALIASES) PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(106)
    expect(aliasKinds().length).toBe(106)
  })

  it('9. daftar parent-sibling global TIDAK berubah, amak kind parent di luar daftar itu', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual(['bako', 'bibi', 'budhe', 'emang', 'etek', 'makcik', 'mama', 'mamak', 'mami', 'mang', 'om', 'pakcik', 'pakde', 'pakdhe', 'paklik', 'paman', 'tante', 'uwa'])
    expect(KINSHIP_ALIASES['amak']?.kind).toBe('parent')
  })

  it('10. negatif: amakk typo nihil, normalisasi AMAK dan spasi pinggir sama dengan amak', () => {
    expect(resolveAlias('amakk')).toBeNull()
    expect(resolveAlias('AMAK')).toEqual(resolveAlias('amak'))
    expect(resolveAlias('  Amak ')).toEqual(resolveAlias('amak'))
  })

  it('11. anti-dup: amak tepat satu kali, urutan qualifier minangkabau global etek amak mamak bako', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'amak')).toHaveLength(1)
    const mk = all.filter((k) => KINSHIP_ALIASES[k]?.qualifier === 'minangkabau')
    expect(mk).toEqual(['etek', 'amak', 'mamak', 'bako']) // urutan asli map; amak menyisip antara pakde dan mamak pasca v253-xi
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['amak']).toBeUndefined()
    }
  })

  it('12. blok regional Minangkabau tetap nihil, pola mamak global only', () => {
    expect(KINSHIP_ALIASES_REGIONAL['Minangkabau']).toBeUndefined()
  })
})
