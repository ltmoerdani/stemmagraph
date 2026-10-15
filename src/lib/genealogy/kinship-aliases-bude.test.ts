import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key bude (v253xxxii gelombang tiga belas, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026,
 * HTTP 200): bu.de n Jw DUA makna, ibu gede; kakak perempuan ibu
 * atau ayah plus kata sapaan kepada kakak perempuan ibu atau ayah.
 * Plus Wiktionary ID revid 1165956 via api.php blok Bahasa
 * Indonesia: akronim ibu gede; kakak perempuan ibu atau ayah plus
 * panggilan untuk kakak perempuan ibu atau ayah, rujukan R:KBBI
 * Daring, flag rfv impor dari KBBI dicatat jujur pola preseden.
 * GUARD MAKNA 1 KBBI ibu gede TIDAK dipetakan sbg relasi terpisah,
 * yang dipetakan makna kakak perempuan ibu atau ayah.
 * GUARD HOMONIM Nias: blok nia canda kelakar TIDAK dipetakan.
 * Ejaan resmi KBBI ber titik bu.de TIDAK dipakai sbg key (pola
 * budhe dari bu.de, se.du.lur, man.tu).
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind
 * parent-sibling depth 1 qualifier jw region Jawa, resolusi varian,
 * posisi alfabetis sisip antara budhe dan bulik, gugus parent
 * sibling non-regresi, determinisme, guard jumlah 119, dan
 * non-regresi kasus lama bank-lemma yang kini positif.
 */

describe('kinship-aliases bude (v253xxxii gelombang tiga belas)', () => {
  it('1. entri live: kind parent-sibling, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['bude']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
  })

  it('2. resolusi varian: bude, Bude, spasi bude spasi resolve ke entri sama', () => {
    const base = resolveAlias('bude')
    expect(base).not.toBeNull()
    expect(resolveAlias('Bude')).toEqual(base)
    expect(resolveAlias('  bude ')).toEqual(base)
    expect(base?.kind).toBe('parent-sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan resmi ber titik bu.de TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('bu.de')
    expect(resolveAlias('bu.de')).toBeNull()
  })

  it('4. makna 1 KBBI ibu gede TIDAK jadi key terpisah, yang dipetakan makna kakak perempuan ibu atau ayah', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('ibu gede')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('ibugede')
    const r = resolveAlias('bude')
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.kind).not.toBe('parent')
    expect(r?.note).toContain('ibu gede')
    expect(r?.note).toContain('TIDAK dipetakan sbg relasi terpisah')
  })

  it('5. guard homonim Nias: blok nia canda kelakar TIDAK bocor, bude tetap ber-region Jawa', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('nia')
    expect(resolveAlias('nia')).toBeNull()
    const r = resolveAlias('bude')
    expect(r?.region).toBe('Jawa')
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.note).toContain('Nias')
    expect(r?.note).toContain('TIDAK dipetakan')
  })

  it('6. non-regresi: budhe dan pakde tetap utuh parent-sibling depth 1 Jawa', () => {
    expect(KINSHIP_ALIASES['budhe']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['pakde']).toMatchObject({
      kind: 'parent-sibling',
      depth: 1,
      region: 'Jawa',
    })
  })

  it('7. posisi alfabetis: bude sisip antara budhe dan bulik di Object.keys', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iBudhe = keys.indexOf('budhe')
    const iBude = keys.indexOf('bude')
    const iBulik = keys.indexOf('bulik')
    expect(iBudhe).toBeGreaterThanOrEqual(0)
    expect(iBude).toBe(iBudhe + 1)
    expect(iBulik).toBe(iBude + 1)
  })

  it('8. determinisme: dua kali resolve hasil identik', () => {
    const a = resolveAlias('bude')
    const b = resolveAlias('bude')
    expect(a).toEqual(b)
  })

  it('9. guard jumlah key PERSIS 119 pasca gelombang tiga belas', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(138)
    expect(aliasKinds().length).toBe(138)
  })

  it('10. regresi guard: kasus lama bank-lemma bude kini positif, entri ada di source dan klaster PS Jawa jw 6 entri', () => {
    expect(resolveAlias('bude')).not.toBeNull()
    const source = readFileSync(
      new URL('./kinship-aliases.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain('  bude: {')
    expect(source).not.toMatch(/resolveAlias\('bude'\)\)\.toBeNull\(\)/)
    const entries = Object.values(KINSHIP_ALIASES).filter(
      (e) => e.kind === 'parent-sibling' && e.region === 'Jawa' && e.qualifier === 'jw',
    )
    expect(entries).toHaveLength(6)
  })
})
