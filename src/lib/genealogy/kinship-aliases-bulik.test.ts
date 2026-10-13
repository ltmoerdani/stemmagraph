import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key bulik (v253xxv gelombang tujuh, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026,
 * HTTP 200): bu.lik n Jw akr kata sapaan atau panggilan kepada adik
 * perempuan ibu atau ayah; ibu cilik. Plus Wiktionary EN revid 91711298
 * blok Javanese: noun aunt, parent's younger sister, etimologi shortening
 * of ibu cilik, rujukan R:Horne 1974 hal 98.
 * GUARD HOMONIM: ejaan ber titik bu.lik TIDAK jadi key (pola budhe dari
 * bu.de); glosa KBBI ibu cilik etimologis TIDAK dipetakan terpisah; blok
 * ceb (udang), hu (bentukan dari buli), pl (hoki es) di Wiktionary EN sama
 * TIDAK dipetakan; halaman id.wiktionary bulik hanya blok bjn Banjar
 * verba pulang, BUKAN blok Indonesia dan BUKAN blok Jawa, tidak berpengaruh.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind parent-sibling
 * depth 1 qualifier jw region Jawa, gugus paman Jawa lima entri, guard jumlah
 * key 112, posisi sort, dan determinisme resolusi.
 */

describe('kinship-aliases bulik (v253xxv gelombang tujuh, parent-sibling depth 1, Jawa)', () => {
  it('1. entri live: bulik di map global, kind parent-sibling, depth 1, qualifier jw, region Jawa, tanpa register', () => {
    const e = KINSHIP_ALIASES['bulik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias bulik positif kind parent-sibling depth 1, varian ejaan resolve identik', () => {
    const r = resolveAlias('bulik')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('Bulik')).toEqual(r)
    expect(resolveAlias(' bulik ')).toEqual(r)
    expect(resolveAlias('BULIK')).toEqual(r)
  })

  it('3. negatif: ejaan ber titik bu.lik BUKAN key, resolveAlias nihil', () => {
    expect(KINSHIP_ALIASES['bu.lik']).toBeUndefined()
    expect(resolveAlias('bu.lik')).toBeNull()
    expect(resolveAlias('bulik')?.kind).toBe('parent-sibling')
  })

  it('4. non-regresi gugus paman Jawa: pakde paklik pakdhe budhe tetap utuh kind parent-sibling', () => {
    expect(KINSHIP_ALIASES['pakde']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['paklik']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['pakdhe']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['budhe']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
    expect(resolveAlias('pakde')?.kind).toBe('parent-sibling')
    expect(resolveAlias('paklik')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pakdhe')?.kind).toBe('parent-sibling')
    expect(resolveAlias('budhe')?.kind).toBe('parent-sibling')
  })

  it('5. gugus parent-sibling Jawa jadi 5 entri: budhe bulik pakde pakdhe paklik', () => {
    const jw = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling' && KINSHIP_ALIASES[k]?.region === 'Jawa')
      .sort()
    expect(jw).toEqual(['budhe', 'bulik', 'pakde', 'pakdhe', 'paklik'])
    expect(jw).toHaveLength(5)
  })

  it('6. guard homonim: blok ceb hu pl Wiktionary EN dan blok bjn id.wiktionary TIDAK dipetakan, bulik tetap Jawa', () => {
    expect(KINSHIP_ALIASES['bu.lik']).toBeUndefined()
    const r = resolveAlias('bulik')
    expect(r?.qualifier).toBe('jw')
    expect(r?.region).toBe('Jawa')
    const note = KINSHIP_ALIASES['bulik'].note
    expect(note).toContain('Cebuano')
    expect(note).toContain('Hungarian')
    expect(note).toContain('Polish')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('Banjar')
    expect(note).toContain('BUKAN blok Indonesia')
    expect(note).toContain('91711298')
    expect(note).toContain('Horne')
  })

  it('7. guard jumlah key PERSIS 112 pasca v253xxv gelombang tujuh (111 jadi 112: bulik)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(112)
    expect(Object.keys(KINSHIP_ALIASES).length).toBe(112)
    expect(aliasKinds().length).toBe(112)
    expect(aliasKinds()).toContain('bulik')
  })

  it('8. posisi sort: bulik tepat setelah budhe di urutan literal, di antara budhe dan bako, urut alfabetis bak bako bud budhe bul bulik', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys.indexOf('bulik')).toBe(keys.indexOf('budhe') + 1)
    expect(keys.indexOf('bulik')).toBeLessThan(keys.indexOf('bako'))
    const sorted = [...keys].sort()
    expect(sorted.indexOf('bako')).toBeLessThan(sorted.indexOf('budhe'))
    expect(sorted.indexOf('budhe')).toBeLessThan(sorted.indexOf('bulik'))
    expect(['bak', 'bako', 'bul', 'bulik', 'bud', 'budhe'].sort()).toEqual([
      'bak',
      'bako',
      'bud',
      'budhe',
      'bul',
      'bulik',
    ])
  })

  it('9. determinisme: dua kali resolveAlias bulik hasil identik', () => {
    const a = resolveAlias('bulik')
    const b = resolveAlias('bulik')
    expect(a).toEqual(b)
    expect(a).toBe(b)
  })
})
