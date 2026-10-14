import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key ading (v253xli, test-only).
 * Sumber entri DUA SUMBER terverifikasi: KBBI III mirror kbbi.web.id/ading
 * akses 14 Okt 2026 HTTP 200 (ading n cak adik, satu lema nihil homograf
 * bernomor, nihil label daerah) plus Wiktionary ID revid 1292120 via api.php
 * (blok Bahasa Indonesia n cak adik, rujukan R:KBBI Daring, flag rfv dicatat
 * jujur). Register cak HANYA di note, TANPA qualifier, TANPA region, pola
 * entri akak.
 * GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: blok bjn Banjar
 * (adik, adinda), ilo Ilocano, bve Bima, bkr Bakumpai, pse Ogan (adik plus
 * ragam adeng adieng).
 * Makna basis: ading = adik, sibling depth 1, BUKAN parent-child.
 * Entri live ada di kinship-aliases.ts klaster sibling dekat akak, urutan
 * alfabetis internal map: ading sebelum akak.
 */
describe('kinship-aliases ading (v253xli)', () => {
  it('1. entri ading live: kind sibling, depth 1, tanpa qualifier, tanpa region', () => {
    const e = KINSHIP_ALIASES['ading']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
  })

  it('2. resolveAlias ading non-null sibling depth 1, bukan parent-child', () => {
    const r = resolveAlias('ading')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.kind).not.toBe('parent')
    expect(r?.kind).not.toBe('child')
  })

  it('3. note memuat makna basis adik, sumber ganda, dan register cak hanya di note', () => {
    const note = KINSHIP_ALIASES['ading'].note ?? ''
    expect(note).toContain('adik')
    expect(note).toContain('sibling depth 1')
    expect(note).toContain('BUKAN parent-child')
    expect(note).toContain('kbbi.web.id/ading')
    expect(note).toContain('1292120')
    expect(note).toContain('cak')
    expect(note).toContain('flag rfv dicatat jujur')
  })

  it('4. guard homonim antarbahasa Wiktionary: kode blok bjn ilo bve bkr pse nihil sbg key', () => {
    const note = KINSHIP_ALIASES['ading'].note ?? ''
    expect(note).toContain('bjn Banjar')
    expect(note).toContain('ilo Ilocano')
    expect(note).toContain('bve Bima')
    expect(note).toContain('bkr Bakumpai')
    expect(note).toContain('pse Ogan')
    expect(KINSHIP_ALIASES['bjn']).toBeUndefined()
    expect(KINSHIP_ALIASES['ilo']).toBeUndefined()
    expect(KINSHIP_ALIASES['bve']).toBeUndefined()
    expect(KINSHIP_ALIASES['bkr']).toBeUndefined()
    expect(KINSHIP_ALIASES['pse']).toBeUndefined()
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['ading']).toBeUndefined()
    }
  })

  it('5. adeng dan adieng ragam blok pse BUKAN key', () => {
    expect(KINSHIP_ALIASES['adeng']).toBeUndefined()
    expect(KINSHIP_ALIASES['adieng']).toBeUndefined()
    expect(resolveAlias('adeng')).toBeNull()
    expect(resolveAlias('adieng')).toBeNull()
  })

  it('6. non-difusi: adik tetap BUKAN key sementara ading key, pola bungsu', () => {
    expect(KINSHIP_ALIASES['adik']).toBeUndefined()
    expect(resolveAlias('adik')).toBeNull()
    expect(KINSHIP_ALIASES['ading']).toBeDefined()
    expect(resolveAlias('ading')?.kind).toBe('sibling')
    expect(resolveAlias('bungsu')).toBeNull()
  })

  it('7. substring misleading di note kalimbubu BUKAN dup key ading', () => {
    const kalimbubu = KINSHIP_ALIASES_REGIONAL['Karo']['kalimbubu']
    expect(kalimbubu).toBeDefined()
    expect(kalimbubu.note).toContain('misleading')
    expect(resolveAlias('misleading')).toBeNull()
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'ading')).toHaveLength(1)
  })

  it('8. adinda BUKAN key terpisah baru dari item ini, entri existing hor tak tersentuh', () => {
    const adinda = KINSHIP_ALIASES['adinda']
    expect(adinda).toBeDefined()
    expect(adinda.kind).toBe('sibling')
    expect(adinda.depth).toBe(1)
    expect(adinda.region).toBe('hor')
    expect(adinda.register).toBe('hormat')
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'adinda')).toHaveLength(1)
    expect(all.filter((k) => k === 'ading')).toHaveLength(1)
  })

  it('9. urutan alfabetis klaster sibling: ading menempati posisi sebelum akak', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.indexOf('ading')).toBeGreaterThanOrEqual(0)
    expect(all.indexOf('ading')).toBeLessThan(all.indexOf('akak'))
  })

  it('10. non-regresi sibling live: akak kak kakang tetap entri lama tak berubah', () => {
    expect(KINSHIP_ALIASES['akak'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['akak'].qualifier).toBe('cak')
    expect(KINSHIP_ALIASES['kak'].region).toBe('kp')
    expect(KINSHIP_ALIASES['kakang'].region).toBe('Jawa')
    expect(resolveAlias('ading')?.qualifier).toBeUndefined()
  })

  it('11. guard bump total key: Object.keys dan aliasKinds PERSIS 131 pasca v253xlii putra putri, naik dari 129 v253xli ading', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
    expect(aliasKinds().length).toBe(133)
  })

  it('12. note merujuk kontrak dan normalisasi huruf besar tetap kena', () => {
    const note = KINSHIP_ALIASES['ading'].note ?? ''
    expect(note).toContain('drafts/kontrak-stg-v253xli-ading-2026-10-14.md')
    expect(resolveAlias('Ading')?.kind).toBe('sibling')
    expect(resolveAlias('  ADING  ')?.kind).toBe('sibling')
  })
})
