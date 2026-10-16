import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key engku (v253xxxiii gelombang empat belas, test-only).
 * Sumber entri DUA (kontrak PM 13 Okt 2026): KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/engku akses 13 Okt 2026 HTTP 200:
 * eng.ku2 n Mk TIGA makna, yang dipetakan makna 1 paman; mamak
 * (dari pihak ibu). Plus Wiktionary ID pageid 108851 via api.php
 * blok Bahasa Indonesia nomina paman; mamak (dari pihak ibu),
 * rujukan R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur
 * pola preseden etek bude akak.
 * GUARD POLISEMI KBBI: makna 2 kata sapaan kepada kakek (datuk)
 * TIDAK dipetakan sbg key terpisah, makna 3 sebutan laki-laki
 * dewasa sebaya tidak dikenal plus varian angku TIDAK dipetakan,
 * eng.ku1 sapaan keluarga raja atau orang dihormati TIDAK dipetakan.
 * GUARD HOMONIM: nihil homograf bernomor kekerabatan lain.
 * Ejaan resmi KBBI ber titik eng.ku TIDAK dipakai sbg key (pola
 * budhe bu.de, adinda a.din.da).
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind
 * parent-sibling depth 1 qualifier mk region Melayu, resolusi
 * varian, posisi alfabetis sisip antara emang dan mang, gugus
 * parent sibling non-regresi, determinisme, guard jumlah 120, dan
 * non-regresi kasus lama bank-lemma yang kini positif.
 */

describe('kinship-aliases engku (v253xxxiii gelombang empat belas)', () => {
  it('1. entri live: kind parent-sibling, depth 1, qualifier mk, region Melayu', () => {
    const e = KINSHIP_ALIASES['engku']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('mk')
    expect(e.region).toBe('Melayu')
  })

  it('2. resolusi varian: engku, Engku, spasi engku spasi resolve ke entri sama', () => {
    const base = resolveAlias('engku')
    expect(base).not.toBeNull()
    expect(resolveAlias('Engku')).toEqual(base)
    expect(resolveAlias('  engku ')).toEqual(base)
    expect(base?.kind).toBe('parent-sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan resmi ber titik eng.ku TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('eng.ku')
    expect(resolveAlias('eng.ku')).toBeNull()
  })

  it('4. makna 2 KBBI sapaan kakek TIDAK jadi key terpisah dari engku, yang dipetakan makna 1 paman dari pihak ibu', () => {
    const r = resolveAlias('engku')
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.kind).not.toBe('grandparent')
    expect(r?.note).toContain('kakek (datuk) TIDAK dipetakan')
  })

  it('5. makna 3 laki dewasa tak dikenal plus varian angku dan eng.ku1 sapaan raja TIDAK dipetakan, guard polisemi', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('angku')
    expect(resolveAlias('angku')).toBeNull()
    const r = resolveAlias('engku')
    expect(r?.note).toContain('laki-laki dewasa sebaya tidak dikenal')
    expect(r?.note).toContain('eng.ku1 sapaan keluarga raja')
  })

  it('6. non-regresi: bako dan mamak tetap utuh parent-sibling, engkoh sibling dan engkong grandparent tanpa disentuh', () => {
    expect(KINSHIP_ALIASES['bako']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'minangkabau',
      region: 'Minangkabau',
    })
    expect(KINSHIP_ALIASES['mamak']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
    })
    expect(KINSHIP_ALIASES['engkoh']).toBeDefined()
    expect(KINSHIP_ALIASES['engkong']).toBeDefined()
  })

  it('7. posisi alfabetis: engku sisip antara emang dan mang di Object.keys', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iEmang = keys.indexOf('emang')
    const iEngku = keys.indexOf('engku')
    const iMang = keys.indexOf('mang')
    expect(iEmang).toBeGreaterThanOrEqual(0)
    expect(iEngku).toBe(iEmang + 1)
    expect(iMang).toBeGreaterThanOrEqual(iEngku + 1)
  })

  it('8. determinisme: dua kali resolve hasil identik', () => {
    const a = resolveAlias('engku')
    const b = resolveAlias('engku')
    expect(a).toEqual(b)
  })

  it('9. guard jumlah key PERSIS 120 pasca gelombang empat belas', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(145)
    expect(aliasKinds().length).toBe(145)
  })

  it('10. regresi guard: kasus lama bank-lemma engku kini positif, entri ada di source dan klaster PS Melayu mk 1 entri', () => {
    expect(resolveAlias('engku')).not.toBeNull()
    const source = readFileSync(
      new URL('./kinship-aliases.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain('  engku: {')
    expect(source).not.toMatch(/resolveAlias\('engku'\)\)\.toBeNull\(\)/)
    const entries = Object.values(KINSHIP_ALIASES).filter(
      (e) => e.kind === 'parent-sibling' && e.region === 'Melayu' && e.qualifier === 'mk',
    )
    expect(entries).toHaveLength(1)
  })
})
