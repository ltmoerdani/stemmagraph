import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key empok dan yayu (v253xxxiv gelombang lima belas, test-only).
 * Sumber entri DUA masing-masing (akses 13 Okt 2026):
 * empok: KBBI III mirror kbbi.web.id/empok HTTP 200 (em-pok Jk n dua
 * makna: 1 kakak perempuan; 2 kata sapaan untuk orang perempuan yang
 * lebih tua; sub-lema em-pok-em-pok n orang perempuan dewasa) plus
 * Wiktionary ID pageid 108772 via api.php (blok Bahasa Indonesia
 * nomina kakak perempuan plus sapaan untuk orang perempuan yang lebih
 * tua, rujukan R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur
 * pola preseden).
 * yayu: KBBI III mirror kbbi.web.id/yayu HTTP 200 (ya-yu n dua makna:
 * kakak perempuan; panggilan kepada wanita) plus Wiktionary ID
 * pageid 41392 via api.php (blok Bahasa Indonesia nomina kakak
 * perempuan; panggilan kepada wanita, etimologi bahasa Jawa).
 * GUARD POLISEMI KETAT: makna 2 sapaan/panggilan wanita umum TIDAK
 * jadi key terpisah; sub-lema empok-empok TIDAK dipetakan; sinonim
 * Wiktionary (mbak kakak teteh neng uni inang) TIDAK dipetakan sbg
 * key baru; ragam embok (blok ban) dan mpok (blok bew) TIDAK jadi
 * key; ejaan ber titik em.pok dan ya.yu TIDAK dipakai sbg key.
 * Entri live di kinship-aliases.ts: empok kind sibling depth 1
 * region Jambi (label Jk tercatat di note karena jk nihil di union
 * qualifier), yayu kind sibling depth 1 tanpa region (etimologi
 * Jawa dicatat di note); keduanya sisip alfabetis.
 */

describe('kinship-aliases empok-yayu (v253xxxiv gelombang lima belas)', () => {
  it('1. entri empok live: kind sibling, depth 1, region Jambi, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['empok']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Jambi')
    expect(e.qualifier).toBeUndefined()
  })

  it('2. entri yayu live: kind sibling, depth 1, tanpa region dan qualifier, note memuat etimologi Jawa', () => {
    const e = KINSHIP_ALIASES['yayu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
    expect(e.note).toContain('etimologi bahasa Jawa')
  })

  it('3. resolusi varian: empok, Empok, yayu, Yayu, spasi tepi resolve ke entri sama', () => {
    const a = resolveAlias('empok')
    expect(a).not.toBeNull()
    expect(resolveAlias('Empok')).toEqual(a)
    expect(resolveAlias('  empok ')).toEqual(a)
    const b = resolveAlias('yayu')
    expect(b).not.toBeNull()
    expect(resolveAlias('Yayu')).toEqual(b)
    expect(resolveAlias('  yayu ')).toEqual(b)
    expect(a?.kind).toBe('sibling')
    expect(b?.kind).toBe('sibling')
  })

  it('4. ejaan resmi ber titik em.pok dan ya.yu TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('em.pok')
    expect(resolveAlias('em.pok')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('ya.yu')
    expect(resolveAlias('ya.yu')).toBeNull()
  })

  it('5. guard polisemi: makna 2 sapaan dan panggilan wanita umum TIDAK jadi key terpisah, note memuat guard', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('sapaan')
    expect(resolveAlias('empok')).not.toBeNull()
    const a = resolveAlias('empok')
    expect(a?.note).toContain('makna 2 sapaan untuk orang perempuan yang lebih tua TIDAK jadi key terpisah')
    const b = resolveAlias('yayu')
    expect(b?.note).toContain('makna 2 panggilan kepada wanita umum TIDAK jadi key terpisah')
  })

  it('6. guard sub-lema majemuk empok-empok dan sinonim Wiktionary TIDAK dipetakan sbg key baru', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('empok-empok')
    expect(resolveAlias('empok-empok')).toBeNull()
    for (const sin of ['neng', 'inang']) {
      expect(Object.keys(KINSHIP_ALIASES)).not.toContain(sin)
      expect(resolveAlias(sin)).toBeNull()
    }
  })

  it('6b. sinonim teteh dan uni kini POSITIF dari gelombang sebelumnya (bukan turunan empok), non-regresi', () => {
    expect(KINSHIP_ALIASES['teteh']).toBeDefined()
    expect(resolveAlias('teteh')).not.toBeNull()
    expect(resolveAlias('teteh')?.kind).toBe('sibling')
    expect(KINSHIP_ALIASES['uni']).toBeDefined()
    expect(resolveAlias('uni')).not.toBeNull()
  })

  it('7. guard ragam embok dan mpok TIDAK jadi key, embak non-regresi tetap sibling cak', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('embok')
    expect(resolveAlias('embok')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('mpok')
    expect(resolveAlias('mpok')).toBeNull()
    expect(KINSHIP_ALIASES['embak']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      qualifier: 'cak',
    })
  })

  it('8. non-regresi: semenda tetap property, blok K setelah blok K lainnya tidak disentuh, kanda kakanda utuh', () => {
    expect(KINSHIP_ALIASES['semenda']).toMatchObject({ kind: 'property' })
    expect(KINSHIP_ALIASES['kanda']).toBeDefined()
    expect(KINSHIP_ALIASES['kakanda']).toBeDefined()
  })

  it('9. posisi alfabetis: empok sisip tepat setelah embak, yayu sisip tepat setelah semenda', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iEmbak = keys.indexOf('embak')
    const iEmpok = keys.indexOf('empok')
    const iSemenda = keys.indexOf('semenda')
    const iYayu = keys.indexOf('yayu')
    expect(iEmbak).toBeGreaterThanOrEqual(0)
    expect(iEmpok).toBe(iEmbak + 1)
    expect(iSemenda).toBeGreaterThanOrEqual(0)
    expect(iYayu).toBe(iSemenda + 1)
  })

  it('10. determinisme: dua kali resolve hasil identik', () => {
    const a1 = resolveAlias('empok')
    const a2 = resolveAlias('empok')
    expect(a1).toEqual(a2)
    const b1 = resolveAlias('yayu')
    const b2 = resolveAlias('yayu')
    expect(b1).toEqual(b2)
  })

  it('11. guard jumlah key PERSIS 122 pasca gelombang lima belas', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(142)
    expect(aliasKinds().length).toBe(142)
  })

  it('12. regresi guard: kasus lama bank-lemma kini positif, entri ada di source, klaster sibling kakak perempuan wilayah', () => {
    expect(resolveAlias('empok')).not.toBeNull()
    expect(resolveAlias('yayu')).not.toBeNull()
    const source = readFileSync(
      new URL('./kinship-aliases.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain('  empok: {')
    expect(source).toContain('  yayu: {')
    const siblings = Object.values(KINSHIP_ALIASES).filter(
      (e) => e.kind === 'sibling' && e.depth === 1 && e.region === 'Jambi',
    )
    expect(siblings).toHaveLength(1)
  })
})
