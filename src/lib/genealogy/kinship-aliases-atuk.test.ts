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
 * v253-xviii: atuk (datuk Kupang, kind grandparent depth 1 qualifier cak,
 * dua sumber, kontrak PM v253-xviii ATUK TUNGGAL revisi 11 Okt 2026).
 * mbah GUGUR anti-dup (live key jw Jawa), papah dan datuk DITAHAN
 * keputusan scope lemma umum. Entri masuk map GLOBAL pola andung inyik;
 * blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Homonim a.tuk2 Btk atap
 * daun nipah atau sagu TIDAK dipetakan (kasus negatif).
 * Total key global naik PERSIS 1 (95 jadi 96).
 */
describe('kinship-aliases atuk (v253-xviii, grandparent depth 1 Kupang)', () => {
  it('1. entri live: atuk di map global, kind grandparent, depth 1, qualifier cak, region Kupang', () => {
    const e = KINSHIP_ALIASES['atuk']
    expect(e).toBeDefined()
    expect(e.kind).toBe('grandparent')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('cak')
    expect(e.region).toBe('Kupang')
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias atuk positif tanpa region, normalisasi huruf besar dan spasi pinggir', () => {
    const r = resolveAlias('atuk')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('ATUK')).toEqual(r)
    expect(resolveAlias('  Atuk ')).toEqual(r)
  })

  it('3. resolveAlias region lain tetap resolve via global (semantik resolver aktual: regional prioritas, global fallback)', () => {
    const r = resolveAlias('atuk', 'Jawa')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toBe('Kupang')
  })

  it('4. kinshipAliasPhrase id dan en untuk key baru: kakek nenek depth 1', () => {
    expect(kinshipAliasPhrase('atuk', 'id')).toBe('kakek nenek (1 generasi)')
    expect(kinshipAliasPhrase('atuk', 'en')).toBe('grandparent (1 generations)')
  })

  it('5. expandAliasQuery dari search-filter memuat atuk', () => {
    const ex = expandAliasQuery('atuk')
    expect(ex).toContain('atuk')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('6. note memuat dua sumber: KBBI VI a.tuk1 cak kp datuk, revid 1141273, tanggal akses 12 Okt 2026', () => {
    const note = resolveAlias('atuk')?.note ?? ''
    expect(note).toContain('a.tuk1')
    expect(note).toContain('cak kp')
    expect(note).toContain('datuk')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/atuk')
    expect(note).toContain('12 Okt 2026')
    expect(note).toContain('1141273')
    expect(note).toContain('api.php')
  })

  it('7. guard homonim a.tuk2: atap daun nipah atau sagu tidak dipetakan, kasus negatif', () => {
    const note = resolveAlias('atuk')?.note ?? ''
    expect(note).toContain('a.tuk2')
    expect(note).toContain('atap')
    expect(note).toContain('tidak dipetakan')
    expect(KINSHIP_ALIASES['atuk (atap)']).toBeUndefined()
    expect(KINSHIP_ALIASES['atuk2']).toBeUndefined()
    expect(resolveAlias('atuk')?.kind).toBe('grandparent')
  })

  it('8. negatif: typo nihil', () => {
    expect(resolveAlias('atukk')).toBeNull()
    expect(resolveAlias('atuk datuk')).toBeNull()
  })

  it('9. non-regresi tetangga gugus grandparent regional: atok datuk Melayu, opa oma Betawi, inyik mk, embah eyang Jawa', () => {
    expect(resolveAlias('atok')?.region).toBe('Melayu')
    expect(resolveAlias('datuk')?.region).toBe('Melayu')
    expect(resolveAlias('opa')?.region).toBe('Betawi')
    expect(resolveAlias('oma')?.region).toBe('Betawi')
    expect(resolveAlias('inyik')?.qualifier).toBe('mk')
    expect(resolveAlias('embah')?.qualifier).toBe('jw')
    expect(resolveAlias('eyang')?.register).toBe('hormat')
    expect(resolveAlias('kakek')?.kind).toBe('grandparent')
    expect(resolveAlias('nenek')?.kind).toBe('grandparent')
  })

  it('10. guard bump total key: Object.keys(KINSHIP_ALIASES) PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(132)
    expect(aliasKinds().length).toBe(132)
  })

  it('11. daftar key gugus grandparent global toEqual pasca v253xxx gelombang sebelas (18 key, atuk menyisip setelah atok sebelum opa, simbah menyisip setelah embah sebelum engkong)', () => {
    const gp = Object.keys(KINSHIP_ALIASES).filter(
      (k) => KINSHIP_ALIASES[k]?.kind === 'grandparent'
    )
    expect(gp).toEqual([
      'kakek',
      'nenek',
      'aki',
      'datuk',
      'atok',
      'atuk',
      'opa',
      'oma',
      'eyang',
      'mbah',
      'embah',
      'simbah',
      'engkong',
      'akong',
      'andung',
      'inyik',
      'nini',
      'ninik',
    ])
    expect(gp).toHaveLength(18)
  })

  it('12. anti-dup: atuk tepat satu kali, nihil di blok regional mana pun, nihil region baru Kupang di KINSHIP_ALIASES_REGIONAL', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'atuk')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['atuk']).toBeUndefined()
    }
    expect(KINSHIP_ALIASES_REGIONAL['Kupang']).toBeUndefined()
  })
})
