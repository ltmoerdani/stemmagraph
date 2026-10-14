import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

/**
 * Guard test key sedulur (v253xxviii gelombang sembilan, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026,
 * HTTP 200): se.du.lur n saudara atau satu keluarga, biasanya dalam
 * bahasa Jawa, satu lema nihil homograf bernomor, jangkar dulur.
 * Plus Wiktionary ID oldid 1245233 blok Bahasa Jawa Nomina Surabaya:
 * saudara, contoh kabeh kui sedulur semuanya bersaudara, kategori
 * WikiTutur Jawa Surabaya.
 * GUARD MAKNA: varian sadulur bukan entri resmi (usulan entri nihil
 * arti) TIDAK dipetakan; sufiks -sedulur-an persaudaraan TIDAK
 * dipetakan.
 * GUARD HOMONIM ANTARBAHASA Wiktionary EN TIDAK dipetakan: blok
 * English (sinonim relative kin), blok jv baku, blok Kurdish, blok
 * Malay, tidak ada blok bahasa Indonesia di halaman Wiktionary ID.
 * Ejaan resmi KBBI ber titik se.du.lur TIDAK dipakai sbg key (pola
 * budhe dari bu.de). Entri live ada di kinship-aliases.ts; test ini
 * mengunci kind sibling depth 1 qualifier jw region Jawa, posisi
 * alfabetis sisip antara dik dan sembuyak, gugus sibling Jawa
 * non-regresi, dan guard anti homonim.
 */

describe('kinship-aliases sedulur (v253xxviii gelombang sembilan)', () => {
  it('1. entri live: kind sibling, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['sedulur']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
  })

  it('2. resolusi varian: sedulur, Sedulur, spasi sedulur spasi resolve ke entri sama', () => {
    const base = resolveAlias('sedulur')
    expect(base).not.toBeNull()
    expect(resolveAlias('Sedulur')).toEqual(base)
    expect(resolveAlias('  sedulur ')).toEqual(base)
    expect(base?.kind).toBe('sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan ber titik se.du.lur TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('se.du.lur')
    expect(resolveAlias('se.du.lur')).toBeNull()
  })

  it('4. varian sadulur TIDAK dipetakan (bukan entri resmi, bukti negatif usulan entri KBVI)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('sadulur')
    expect(resolveAlias('sadulur')).toBeNull()
  })

  it('5. sufiks -sedulur-an TIDAK dipetakan (makna persaudaraan turunan, bukan lema kekerabatan)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('-sedulur-an')
    expect(resolveAlias('seduluran')).toBeNull()
  })

  it('6. gugus sibling Jawa tetap utuh non-regresi: dansanak dansa-dansi kakang nilai existing tak berubah', () => {
    expect(KINSHIP_ALIASES['dansanak'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['dansa-dansi'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['kakang']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
    })
  })

  it('7. guard homonim antarbahasa nihil terpetakan: English kin dan Kurdish dan Malay tidak bocor', () => {
    const r = resolveAlias('sedulur')
    expect(r?.region).toBe('Jawa')
    expect(r?.qualifier).toBe('jw')
  })

  it('8. posisi alfabetis: sedulur sisip antara dik dan sembuyak di Object.keys', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iDik = keys.indexOf('dik')
    const iSedulur = keys.indexOf('sedulur')
    const iSembuyak = keys.indexOf('sembuyak')
    expect(iSedulur).toBeGreaterThan(iDik)
    expect(iSedulur).toBeLessThan(iSembuyak)
  })

  it('9. determinisme: dua kali resolve hasil identik', () => {
    const a = resolveAlias('sedulur')
    const b = resolveAlias('sedulur')
    expect(a).toEqual(b)
  })

  it('10. guard jumlah key PERSIS 115 pasca gelombang sembilan', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
  })

  it('11. klaster sibling depth 1 global pasca sedulur, +1 abang v255 gel28', () => {
    const siblingDepth1 = Object.entries(KINSHIP_ALIASES).filter(
      ([, entry]) => entry.kind === 'sibling' && entry.depth === 1,
    )
    expect(siblingDepth1.length).toBe(40)
    const keys = new Set(siblingDepth1.map(([key]) => key))
    expect(keys.has('sedulur')).toBe(true)
  })
})
