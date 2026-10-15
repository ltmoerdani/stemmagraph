import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'
import { resolveAgeCompositePhrase } from './kinship-age-axis'

/**
 * Guard test lema bungsu (gel41, kind sibling depth 1 baku nasional, test-only).
 * Dua sumber first-hand 16 Okt 2026: KBBI III mirror kbbi.web.id/bungsu
 * (bung su n yang terakhir; yang termuda (tentang anak), satu lema nihil
 * homograf bernomor) plus Wiktionary ID pageid 112572 revid 1397504 via
 * api.php (blok Bahasa Indonesia nomina definisi identik KBBI, rujukan
 * R:KBBI Daring, flag rfv impor dicatat jujur pola preseden pakde ponakan
 * putra putri). REVISI EKSPLISIT kontrak ucu v253-xvi dan kontrak sulung
 * gel32 yang menahan bungsu nihil key tunggal: guard lama adalah pembekuan
 * status quo, dicabut keputusan leksikon PM 16 Okt karena bungsu lemma
 * mandiri KBBI register standar dan simetri sulung vs bungsu kini lengkap.
 * Guard: komposit anatomi geraham bungsu gigi bungsu tidak dipetakan,
 * anak bungsu komposit produktif tidak jadi key terpisah, ucu tetap
 * sibling arkais, ading tetap Karo, sulung tetap tua, age-axis nihil
 * perubahan. Total map 143 menjadi 144.
 */
describe('kinship-aliases bungsu (gel41)', () => {
  const GUARD_KEYS = 144

  it('1. positif: bungsu live kind sibling depth 1', () => {
    const e = KINSHIP_ALIASES['bungsu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(resolveAlias('bungsu')?.kind).toBe('sibling')
  })

  it('2. baku nasional: tanpa region tanpa register tanpa qualifier (pola sulung)', () => {
    const e = KINSHIP_ALIASES['bungsu']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi komposit anatomi: geraham bungsu nihil key exact-phrase', () => {
    expect(KINSHIP_ALIASES['geraham bungsu']).toBeUndefined()
    expect(resolveAlias('geraham bungsu')).toBeNull()
  })

  it('4. negasi komposit anatomi: gigi bungsu nihil key exact-phrase', () => {
    expect(KINSHIP_ALIASES['gigi bungsu']).toBeUndefined()
    expect(resolveAlias('gigi bungsu')).toBeNull()
  })

  it('5. negasi komposit produktif: anak bungsu nihil key terpisah (tercover lema tunggal pola anak sulung)', () => {
    expect(KINSHIP_ALIASES['anak bungsu']).toBeUndefined()
  })

  it('6. anti-difusi: ucu tetap sibling arkais key sendiri, dua key terpisah', () => {
    const u = KINSHIP_ALIASES['ucu']
    expect(u).toBeDefined()
    expect(u.kind).toBe('sibling')
    expect(u.depth).toBe(1)
    expect(KINSHIP_ALIASES['bungsu']).not.toBe(u)
  })

  it('7. anti-difusi: sulung tetap sibling tua key sendiri, simetri sulung vs bungsu', () => {
    const s = KINSHIP_ALIASES['sulung']
    expect(s).toBeDefined()
    expect(s.kind).toBe('sibling')
    expect(KINSHIP_ALIASES['bungsu']).not.toBe(s)
  })

  it('8. anti-difusi: ading tetap Karo sibling key sendiri', () => {
    const a = KINSHIP_ALIASES['ading']
    expect(a).toBeDefined()
    expect(a.kind).toBe('sibling')
    expect(a.depth).toBe(1)
    expect(KINSHIP_ALIASES['bungsu']).not.toBe(a)
  })

  it('9. age-axis nihil perubahan: adik bungsu tetap komposit younger di resolver terpisah', () => {
    expect(resolveAgeCompositePhrase('adik bungsu')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('10. urutan sisip alfabetis: bungsu antara budhe dan bude', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys[keys.indexOf('bungsu') - 1]).toBe('budhe')
    expect(keys[keys.indexOf('bungsu') + 1]).toBe('bude')
  })

  it('11. nihil duplikat dan nihil di blacklist', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(new Set(keys).size).toBe(keys.length)
    expect(aliasKinds()).toContain('bungsu')
  })

  it('12. total map PERSIS 144 dan aliasKinds 144 pasca gel41 (GUARD_KEYS bump 143 jadi 144)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })
})
