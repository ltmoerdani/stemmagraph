import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key raka (v253xxxv gelombang enam belas, test-only).
 * Sumber entri DUA (kontrak PM 14 Okt 2026): KBBI III mirror
 * kbbi.web.id/raka akses 14 Okt 2026 HTTP 200: ra-ka1 n 1 Jw
 * kakak laki-laki; 2 sebutan kepada mahasiswa senior pada masa
 * perploncoan. Plus Wiktionary ID via api.php: blok Bahasa
 * Indonesia nomina kakak laki-laki plus sebutan mahasiswa senior
 * masa perploncoan, blok adj retak homograf, rujukan R:KBBI
 * Daring, flag rfv impor dari KBBI dicatat jujur pola preseden
 * empok yayu.
 * GUARD POLISEMI KBBI: makna 2 sebutan mahasiswa senior
 * perploncoan TIDAK dipetakan sbg key terpisah karena sebutan
 * pergaulan bukan relasi kekerabatan.
 * GUARD HOMOGRAF: adj retak TIDAK dipetakan, raka2 dan ejaan
 * ber titik ra.ka TIDAK dibuat sbg key (pola budhe bu.de).
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind
 * sibling depth 1 region Jawa, resolusi varian, posisi alfabetis
 * sisip di ujung blok maskulin kakak laki-laki antara kakanda dan
 * engkoh, gugus sibling non-regresi, determinisme, guard jumlah
 * 126, dan klaster sibling depth 1 kini 37.
 */

describe('kinship-aliases raka (v253xxxv gelombang enam belas)', () => {
  it('1. entri live: kind sibling, depth 1, region Jawa', () => {
    const e = KINSHIP_ALIASES['raka']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Jawa')
  })

  it('2. resolusi varian: raka, Raka, spasi raka spasi resolve ke entri sama', () => {
    const base = resolveAlias('raka')
    expect(base).not.toBeNull()
    expect(resolveAlias('Raka')).toEqual(base)
    expect(resolveAlias('  raka ')).toEqual(base)
    expect(base?.kind).toBe('sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan resmi ber titik ra.ka TIDAK jadi key (pola budhe dari bu.de), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('ra.ka')
    expect(resolveAlias('ra.ka')).toBeNull()
  })

  it('4. makna 2 KBBI sebutan mahasiswa senior perploncoan TIDAK jadi key terpisah, yang dipetakan makna 1 kakak laki-laki', () => {
    const r = resolveAlias('raka')
    expect(r?.kind).toBe('sibling')
    expect(r?.note).toContain('perploncoan TIDAK jadi key terpisah')
  })

  it('5. homograf adj retak TIDAK dipetakan, raka2 TIDAK jadi key, guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('retak')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('raka2')
    expect(resolveAlias('retak')).toBeNull()
    const r = resolveAlias('raka')
    expect(r?.note).toContain('adj retak TIDAK dipetakan')
  })

  it('6. non-regresi: blok maskulin kakak laki-laki Jawa tetap utuh', () => {
    expect(KINSHIP_ALIASES['kangmas']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['mas']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['kakanda']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
      register: 'hormat',
    })
  })

  it('7. posisi alfabetis: raka sisip antara kakanda dan engkoh di Object.keys', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iKakanda = keys.indexOf('kakanda')
    const iRaka = keys.indexOf('raka')
    const iEngkoh = keys.indexOf('engkoh')
    expect(iKakanda).toBeGreaterThanOrEqual(0)
    expect(iRaka).toBe(iKakanda + 1)
    expect(iEngkoh).toBe(iRaka + 1)
  })

  it('8. determinisme: dua kali resolve hasil identik', () => {
    const a = resolveAlias('raka')
    const b = resolveAlias('raka')
    expect(a).toEqual(b)
  })

  it('9. guard jumlah key PERSIS 126 pasca gelombang sembilan belas', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(136)
    expect(aliasKinds().length).toBe(136)
  })

  it('10. klaster sibling depth 1 global pasca raka, +1 abang v255 gel28', () => {
    const siblingDepth1 = Object.entries(KINSHIP_ALIASES).filter(
      ([, entry]) => entry.kind === 'sibling' && entry.depth === 1,
    )
    expect(siblingDepth1.length).toBe(41)
    const keys = new Set(siblingDepth1.map(([key]) => key))
    expect(keys.has('raka')).toBe(true)
  })
})
