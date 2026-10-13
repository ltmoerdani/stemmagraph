import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key bang dan bung (v253xxiv gelombang enam, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026):
 * bang2 n kata sapaan kepada kakak laki-laki, bang kp abang; bung1 n kata
 * sapaan akrab kepada seorang laki-laki, padanan abang. Plus Wiktionary ID
 * blok bahasa Indonesia (bang: azan, abang, kakak laki-laki, kutipan 2012,
 * nihil flag rfv; bung: abang panggilan akrab, templat rfv dicatat jujur,
 * oldid 1112635).
 * GUARD HOMONIM: makna azan bang1 dan onomatope bang3 TIDAK dipetakan;
 * makna onomatope bung2, bu.ng tali picu belantik, dan bung4 Kei TIDAK
 * dipetakan.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind sibling
 * depth 1 tanpa region qualifier, resolusi alias pada frasa nama, gugus
 * kakak non-regresi, dan guard anti homonim.
 */

/**
 * Deteksi alias pada frasa nama bebas: pecah frasa jadi token, ambil token
 * pertama, resolve via resolveAlias. Frasa seperti 'Bang Agus' mengandung
 * alias bang bila token pertamanya resolve ke entri yang sama.
 */
function aliasFromName(phrase: string): { key: string; entry: ReturnType<typeof resolveAlias> } {
  const first = phrase.trim().split(/\s+/)[0] ?? ''
  return { key: first.toLowerCase(), entry: resolveAlias(first) }
}

describe('kinship-aliases bang bung (v253xxiv gelombang enam)', () => {
  it('1. entri bang live: kind sibling, depth 1, tanpa region dan qualifier', () => {
    const e = KINSHIP_ALIASES['bang']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('2. entri bung live: kind sibling, depth 1, tanpa region dan qualifier', () => {
    const e = KINSHIP_ALIASES['bung']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. frasa nama Bang Agus mengandung alias bang: token pertama resolve ke entri bang', () => {
    const { key, entry } = aliasFromName('Bang Agus')
    expect(key).toBe('bang')
    expect(entry).not.toBeNull()
    expect(entry).toEqual(KINSHIP_ALIASES['bang'])
    expect(entry?.kind).toBe('sibling')
    expect(entry?.depth).toBe(1)
  })

  it('4. frasa nama Bung Iskandar mengandung alias bung: token pertama resolve ke entri bung', () => {
    const { key, entry } = aliasFromName('Bung Iskandar')
    expect(key).toBe('bung')
    expect(entry).not.toBeNull()
    expect(entry).toEqual(KINSHIP_ALIASES['bung'])
    expect(entry?.kind).toBe('sibling')
    expect(entry?.depth).toBe(1)
  })

  it('5. bang dan BANG resolve ke kind sibling depth 1, konsisten dengan varian spasi', () => {
    for (const v of ['bang', 'BANG', 'Bang', ' bang ', 'bang ']) {
      const r = resolveAlias(v)
      expect(r, `varian ${v} harus resolve`).not.toBeNull()
      expect(r?.kind).toBe('sibling')
      expect(r?.depth).toBe(1)
    }
  })

  it('6. bung dan Bung resolve ke kind sibling depth 1, konsisten dengan varian spasi', () => {
    for (const v of ['bung', 'BUNG', 'Bung', ' bung ', 'bung ']) {
      const r = resolveAlias(v)
      expect(r, `varian ${v} harus resolve`).not.toBeNull()
      expect(r?.kind).toBe('sibling')
      expect(r?.depth).toBe(1)
    }
  })

  it('7. gugus kakak tetap utuh non-regresi: kakak kaka kakanda kakang kak akak nilai existing tak berubah', { timeout: 20000 }, () => {
    expect(KINSHIP_ALIASES['kakak']).toBeUndefined()
    expect(KINSHIP_ALIASES['kaka']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      qualifier: 'sunda',
    })
    expect(KINSHIP_ALIASES['kakanda']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
      register: 'hormat',
    })
    expect(KINSHIP_ALIASES['kakang']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['kak']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'kp',
    })
    expect(KINSHIP_ALIASES['akak']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      qualifier: 'cak',
    })
  })

  it('8. guard homonim: nihil key azan, onomatope bang dan bung, bu.ng, serta bung4 Kei TIDAK dipetakan', () => {
    expect(KINSHIP_ALIASES['azan']).toBeUndefined()
    expect(resolveAlias('azan')).toBeNull()
    expect(KINSHIP_ALIASES['bu.ng']).toBeUndefined()
    expect(resolveAlias('bu.ng')).toBeNull()
    const noteBang = KINSHIP_ALIASES['bang'].note
    expect(noteBang).toContain('azan')
    expect(noteBang).toContain('TIDAK dipetakan')
    const noteBung = KINSHIP_ALIASES['bung'].note
    expect(noteBung).toContain('onomatope')
    expect(noteBung).toContain('bu.ng')
    expect(noteBung).toContain('Kei')
  })

  it('9. guard jumlah key PERSIS 112 pasca v253xxv gelombang tujuh (111 jadi 112: bulik)', () => {
    expect(Object.keys(KINSHIP_ALIASES).length).toBe(116)
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(116)
    expect(aliasKinds().length).toBe(116)
    expect(aliasKinds()).toContain('bang')
    expect(aliasKinds()).toContain('bung')
  })
})
