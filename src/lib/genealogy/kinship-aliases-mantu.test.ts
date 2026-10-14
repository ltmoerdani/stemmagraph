import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

/**
 * Guard test key mantu (v253xxix gelombang sepuluh, test-only).
 * Sumber entri DUA (riset-069 first-hand 13 Okt 2026):
 * KBBI VI resmi kemendikdasmen man.tu dua kelas kata: n menantu;
 * v cak mengawinkan anak, mengadakan pesta perkawinan anak, contoh
 * Pak Camat akan mantu minggu depan. Tunggal, nihil homograf bernomor.
 * Wiktionary ID pageid 95509 revid 1462853 (9 Jul 2026): id n menantu
 * plus v cak mengawinkan anak; etimologi Jawa Kuno mantu rujukan
 * Zoetmulder; blok mui-plm, bew, jv menantu; blok tes istri atau
 * suami dari anak kita.
 * GUARD POLISEMI KBBI: makna verba cak mengawinkan anak TIDAK dipetakan
 * sbg relasi kekerabatan, hanya nomina yang jadi kind property.
 * GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: blok Mandailing
 * (mui-plm), Batak Dairi (bew), Jawa (jv), Tese (tes) semuanya makna
 * sama nomina menantu, satu key Indonesia cukup.
 * Ejaan resmi KBBI ber titik man.tu TIDAK dipakai sbg key (pola budhe
 * dari bu.de). Bentuk tidak baku minantu tetap dicatat di note menantu.
 * Entri live ada di kinship-aliases.ts sisip alfabetis antara mang dan
 * menantu; test ini mengunci kind property tanpa depth tanpa qualifier
 * tanpa region, gugus affine 6 key, dan guard anti polisemi homonim.
 */

describe('kinship-aliases mantu (v253xxix gelombang sepuluh)', () => {
  it('1. entri live: kind property, tanpa depth qualifier region', () => {
    const e = KINSHIP_ALIASES['mantu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
  })

  it('2. resolusi varian: mantu, Mantu, MANTU, spasi mantu spasi resolve entri sama', () => {
    const base = resolveAlias('mantu')
    expect(base).not.toBeNull()
    expect(base?.kind).toBe('property')
    expect(resolveAlias('Mantu')).toEqual(base)
    expect(resolveAlias('MANTU')).toEqual(base)
    expect(resolveAlias('  mantu ')).toEqual(base)
  })

  it('3. ejaan ber titik man.tu TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('man.tu')
    expect(resolveAlias('man.tu')).toBeNull()
  })

  it('4. gugus affine baku konsisten: property eksak 6 key dgn mantu sisip alfabetis', () => {
    const props = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'property')
      .sort()
    expect(props).toEqual(['besan', 'biras', 'ipar', 'mantu', 'menantu', 'mertua', 'semenda'])
  })

  it('5. posisi alfabetis sisip antara mang dan menantu, mantu key mandiri bukan duplikat menantu', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys.indexOf('mang')).toBeLessThan(keys.indexOf('mantu'))
    expect(keys.indexOf('mantu')).toBeLessThan(keys.indexOf('menantu'))
    expect(KINSHIP_ALIASES['menantu']).toBeDefined()
    expect(KINSHIP_ALIASES['mantu']).not.toBe(KINSHIP_ALIASES['menantu'])
  })

  it('6. guard polisemi verba: kalimat kegiatan mantu dan bentuk memantu tidak terpetakan relasi', () => {
    expect(resolveAlias('akan mantu minggu depan')).toBeNull()
    expect(resolveAlias('memantu')).toBeNull()
    expect(resolveAlias('pesta mantu')).toBeNull()
  })

  it('7. guard bentuk tidak baku minantu dan se-mantu nihil sbg key', () => {
    expect(KINSHIP_ALIASES['minantu']).toBeUndefined()
    expect(resolveAlias('minantu')).toBeNull()
    expect(KINSHIP_ALIASES['semantu']).toBeUndefined()
  })

  it('8. note sumber lengkap: KBBI VI plus Wiktionary revid 1462853, polisemi dan homonim tercatat', () => {
    const note = KINSHIP_ALIASES['mantu']?.note ?? ''
    expect(note).toContain('1462853')
    expect(note).toContain('KBBI VI')
    expect(note).toContain('GUARD POLISEMI')
    expect(note).toContain('GUARD HOMONIM ANTARBAHASA')
    expect(note).toContain('man.tu')
  })

  it('9. non-regresi gugus affine dan sibling: menantu mertua besan ipar semenda sedulur tetap utuh', () => {
    for (const k of ['menantu', 'mertua', 'besan', 'ipar', 'semenda']) {
      expect(KINSHIP_ALIASES[k]?.kind).toBe('property')
      expect(resolveAlias(k)).not.toBeNull()
    }
    expect(KINSHIP_ALIASES['sedulur']?.kind).toBe('sibling')
  })
})
