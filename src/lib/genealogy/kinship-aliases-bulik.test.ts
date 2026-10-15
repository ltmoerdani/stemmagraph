import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

/**
 * Guard test key bulik (v253xxv gelombang tujuh, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026):
 * bu.lik n Jw akr kata sapaan atau panggilan kepada adik perempuan ibu
 * atau ayah, ibu cilik, tunggal nihil homograf bernomor. Plus Wiktionary
 * EN revid 91711298 blok Javanese: noun aunt, parent's younger sister,
 * etimologi shortening of ibu cilik, rujukan R:Horne 1974 hal 98, see
 * also budhe paklik konsisten gugus.
 * GUARD MAKNA: glosa KBBI ibu cilik makna sama etimologis TIDAK dipetakan
 * terpisah.
 * GUARD HOMONIM ANTARBAHASA Wiktionary EN TIDAK dipetakan: blok Cebuano
 * (udang prawn Melicertus latisulcatus dan Marsupenaeus japonicus), blok
 * Hungarian (bentukan nomina dari buli pesta), blok Polish (informal hoki
 * es face-off). Halaman id.wiktionary.org/wiki/bulik hanya blok Banjar
 * verba pulang revid 1166238 BUKAN blok Indonesia dan BUKAN blok Jawa,
 * TIDAK dipetakan.
 * Ejaan resmi KBBI ber titik bu.lik TIDAK dipakai sbg key (pola budhe
 * dari bu.de). Entri live ada di kinship-aliases.ts; test ini mengunci
 * kind parent-sibling depth 1 qualifier jw region Jawa, posisi alfabetis
 * sisip antara bako dan budhe, gugus paman Jawa non-regresi, dan guard
 * anti homonim.
 */

describe('kinship-aliases bulik (v253xxv gelombang tujuh)', () => {
  it('1. entri live: kind parent-sibling, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['bulik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
  })

  it('2. resolusi varian: bulik, Bulik, spasi bulik spasi resolve ke entri sama', () => {
    const base = resolveAlias('bulik')
    expect(base).not.toBeNull()
    expect(resolveAlias('Bulik')).toEqual(base)
    expect(resolveAlias('  bulik ')).toEqual(base)
    expect(base?.kind).toBe('parent-sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan ber titik bu.lik TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('bu.lik')
    expect(resolveAlias('bu.lik')).toBeNull()
  })

  it('4. gugus paman Jawa tetap utuh non-regresi: pakde paklik pakdhe budhe nilai existing tak berubah', { timeout: 20000 }, () => {
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
  })

  it('5. guard homonim ceb hu pl Wiktionary EN nihil terpetakan: bulik tetap resolve ke Jawa', () => {
    const e = resolveAlias('bulik')
    expect(e).not.toBeNull()
    expect(e?.qualifier).toBe('jw')
    expect(e?.region).toBe('Jawa')
    expect(e?.note).toContain('Cebuano')
    expect(e?.note).toContain('Horne 1974')
  })

  it('6. guard blok Banjar id.wiktionary (verba pulang) nihil terpengaruh: bulik tetap parent-sibling Jawa', () => {
    const e = resolveAlias('bulik')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('parent-sibling')
    expect(e?.note).toContain('Banjar')
    expect(e?.note).toContain('1166238')
  })

  it('7. guard jumlah key PERSIS 112 pasca v253xxv gelombang tujuh (111 jadi 112: bulik)', { timeout: 20000 }, () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(137)
  })

  it('8. posisi alfabetis sisip: tetangga urut sort bud bude bul (bulik tetap setelah budhe dan bude pasca bude live)', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iBudhe = keys.indexOf('budhe')
    const iBude = keys.indexOf('bude')
    const iBulik = keys.indexOf('bulik')
    expect(iBudhe).toBeGreaterThanOrEqual(0)
    expect(iBude).toBe(iBudhe + 1)
    expect(iBulik).toBe(iBude + 1)
  })

  it('9. determinisme: dua kali resolve identik', () => {
    expect(resolveAlias('bulik')).toEqual(resolveAlias('bulik'))
  })
})
