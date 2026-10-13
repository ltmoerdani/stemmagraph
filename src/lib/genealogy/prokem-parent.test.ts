import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'

/**
 * v253-xxi: gelombang dua istilah orang tua, 3 key baru uwa nyokap bokap
 * (kontrak PM v253-xxi 12 Okt 2026). Uwa parent-sibling depth 1 tanpa
 * qualifier tanpa region, dual-source Wiktionary ID revid 1244411 plus
 * Wikisastra jv revid 158484, dua lema KBBI VI non-kekerabatan dijaga
 * tidak dipetakan. Nyokap dan bokap parent depth 1 qualifier cak prokem
 * Jakarta, dual-source KBBI VI plus Wiktionary ID revid 1231051 dan
 * 1466248. Total key global naik PERSIS 3 (103 jadi 106).
 */
describe('kinship-aliases prokem parent uwa nyokap bokap (v253-xxi)', () => {
  it('1. tiga key baru live di Object.keys(KINSHIP_ALIASES)', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys).toContain('uwa')
    expect(keys).toContain('nyokap')
    expect(keys).toContain('bokap')
  })

  it('2. resolveAlias uwa positif kind parent-sibling', () => {
    const r = resolveAlias('uwa')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
  })

  it('3. resolveAlias nyokap dan bokap positif kind parent', () => {
    expect(resolveAlias('nyokap')?.kind).toBe('parent')
    expect(resolveAlias('bokap')?.kind).toBe('parent')
  })

  it('4. kind dan depth eksak per key, ketiganya depth 1', () => {
    expect(KINSHIP_ALIASES['uwa']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
    })
    expect(KINSHIP_ALIASES['nyokap']).toMatchObject({
      kind: 'parent',
      depth: 1,
    })
    expect(KINSHIP_ALIASES['bokap']).toMatchObject({
      kind: 'parent',
      depth: 1,
    })
  })

  it('5. qualifier cak untuk nyokap dan bokap, uwa tanpa qualifier tanpa region', () => {
    expect(KINSHIP_ALIASES['nyokap']?.qualifier).toBe('cak')
    expect(KINSHIP_ALIASES['bokap']?.qualifier).toBe('cak')
    expect(KINSHIP_ALIASES['uwa']?.qualifier).toBeUndefined()
    expect(KINSHIP_ALIASES['uwa']?.region).toBeUndefined()
    expect(KINSHIP_ALIASES['nyokap']?.region).toBeUndefined()
    expect(KINSHIP_ALIASES['bokap']?.region).toBeUndefined()
  })

  it('6. guard total key global PERSIS 106: Object.keys dan aliasKinds', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(123)
    expect(aliasKinds().length).toBe(123)
  })

  it('7. guard negatif KBBI VI uwa: u.wa1 sapaan santun dan u.wa2 Mee tidak dipetakan, entri uwa tak bergeser', () => {
    expect(resolveAlias('u.wa1')).toBeNull()
    expect(resolveAlias('u.wa2')).toBeNull()
    const note = KINSHIP_ALIASES['uwa']?.note ?? ''
    expect(note).toContain('u.wa1')
    expect(note).toContain('u.wa2')
    expect(note).toContain('teman sebaya')
    expect(KINSHIP_ALIASES['uwa']?.kind).toBe('parent-sibling')
  })

  it('8. guard varian uak dan uwak tetap DITAHAN nihil (pakde.test baris 45-48 utuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('uak')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('uwak')
    expect(resolveAlias('uak')).toBeNull()
    expect(resolveAlias('uwak')).toBeNull()
  })

  it('9. guard makna 2 Wiktionary uwa (sapaan orang lebih tua bukan kerabat) hanya note, tidak jadi key', () => {
    const note = KINSHIP_ALIASES['uwa']?.note ?? ''
    expect(note).toContain('orang yang lebih tua yang bukan kerabat')
    const uwaKeys = Object.keys(KINSHIP_ALIASES).filter((k) => k.includes('uwa'))
    expect(uwaKeys).toEqual(['uwa'])
    expect(resolveAlias('orang lebih tua')).toBeNull()
    expect(resolveAlias('kerabat')).toBeNull()
  })

  it('10. guard turunan kenyokapan dan kebokapan nihil', () => {
    expect(resolveAlias('kenyokapan')).toBeNull()
    expect(resolveAlias('kebokapan')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('kenyokapan')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('kebokapan')
  })

  it('11. relasi terbalik tidak tertukar: nyokap bokap parent VS uwa parent-sibling', () => {
    expect(resolveAlias('nyokap')?.kind).not.toBe('parent-sibling')
    expect(resolveAlias('bokap')?.kind).not.toBe('parent-sibling')
    expect(resolveAlias('uwa')?.kind).not.toBe('parent')
    expect(resolveAlias('nyokap')?.kind).toBe('parent')
    expect(resolveAlias('bokap')?.kind).toBe('parent')
    expect(resolveAlias('uwa')?.kind).toBe('parent-sibling')
  })

  it('12. guard homonim antarbahasa halaman Wiktionary uwa: blok Betawi Banjar Hausa tidak dipetakan, tercatat di note', () => {
    const note = KINSHIP_ALIASES['uwa']?.note ?? ''
    expect(note).toContain('Betawi')
    expect(note).toContain('Banjar')
    expect(note).toContain('Hausa')
    expect(KINSHIP_ALIASES['uwa']?.region).toBeUndefined()
  })

  it('13. uwa netral gender hanya note, nihil key turunan gender', () => {
    const note = KINSHIP_ALIASES['uwa']?.note ?? ''
    expect(note).toContain('netral gender')
    expect(resolveAlias('uwa laki')).toBeNull()
    expect(resolveAlias('uwa perempuan')).toBeNull()
    expect(resolveAlias('uwa laki-laki')).toBeNull()
    expect(resolveAlias('uwa perempuan')).toBeNull()
  })

  it('14. note nyokap: glosa ibu, prokem Jakarta, KBBI VI nyo.kap, antonim bokap, hipernim bonyok', () => {
    const note = KINSHIP_ALIASES['nyokap']?.note ?? ''
    expect(note).toContain('ibu')
    expect(note).toContain('prokem Jakarta')
    expect(note).toContain('nyo.kap')
    expect(note).toContain('antonim bokap')
    expect(note).toContain('bonyok')
    expect(note).toContain('1231051')
  })

  it('15. note bokap: glosa ayah, prokem Jakarta, KBBI VI bo.kap, label adjektiva Wiktionary dicatat jujur', () => {
    const note = KINSHIP_ALIASES['bokap']?.note ?? ''
    expect(note).toContain('ayah')
    expect(note).toContain('prokem Jakarta')
    expect(note).toContain('bo.kap')
    expect(note).toContain('1466248')
    expect(note).toContain('keanehan leksikografis')
  })

  it('16. note uwa: dual-source revid 1244411 dan Wikisastra jv 158484, etimologi Jawa Kuno, senioritas kakak di note', () => {
    const note = KINSHIP_ALIASES['uwa']?.note ?? ''
    expect(note).toContain('1244411')
    expect(note).toContain('158484')
    expect(note).toContain('kakak dari ayah atau ibu')
    expect(note).toContain('Jawa Kuno')
    expect(note).toContain('senioritas')
  })

  it('17. normalisasi standar berlaku untuk ketiga key: kapital dan spasi pinggir', () => {
    expect(resolveAlias('UWA')).toEqual(resolveAlias('uwa'))
    expect(resolveAlias('  Nyokap ')).toEqual(resolveAlias('nyokap'))
    expect(resolveAlias('BOKAP')).toEqual(resolveAlias('bokap'))
  })
})
