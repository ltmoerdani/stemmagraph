import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'
import { expandAliasQuery } from './search-filter'

/**
 * v253-xvi: ucu (sibling bungsu register ark, dual-source, nihil di src sbg
 * key sebelum entri). Entri masuk map GLOBAL pola senioritas etek teteh;
 * blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key global naik PERSIS 1
 * (92 jadi 93).
 *
 * Dua sumber: KBBI VI u.cu n ark bungsu (akses 11 Okt 2026, HTTP 200, satu
 * lema nihil homograf) plus Wiktionary ID revid 1297573 via api.php (blok id
 * n arkais bungsu, rujukan R:KBBI Daring). Guard: blok ms (kepri) bungsu di
 * halaman Wiktionary sama TIDAK dipetakan; glosa tunggal bungsu TIDAK
 * dipetakan sbg key; register ark nihil padanan interface, tercatat di note.
 */
describe('kinship-aliases ucu (v253-xvi, sibling depth 1, penanda bungsu register ark)', () => {
  it('1. entri live: ucu di map global, kind sibling, depth 1, tanpa qualifier tanpa region tanpa register', () => {
    const e = KINSHIP_ALIASES['ucu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias ucu positif setara saudara, arah balik label kanonik konsisten', () => {
    const r = resolveAlias('ucu')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(kinshipAliasPhrase('ucu', 'id')).toBe('saudara (1 generasi)')
    expect(kinshipAliasPhrase('ucu', 'en')).toBe('sibling (1 generations)')
    expect(expandAliasQuery('ucu')).toEqual(['ucu', 'saudara (1 generasi)'])
  })

  it('3. guard penanda ark di note: KBBI VI dan revid 1297573 tercantum, register ark di note bukan field', () => {
    const note = resolveAlias('ucu')?.note ?? ''
    expect(note).toContain('ark')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/ucu')
    expect(note).toContain('1297573')
    expect(note).toContain('R:KBBI Daring')
    expect(KINSHIP_ALIASES['ucu'].register).toBeUndefined()
  })

  it('4. guard blok ms Kepri negatif: tidak dipetakan sbg key, catatan guard ada di note', () => {
    expect(KINSHIP_ALIASES['kepri']).toBeUndefined()
    expect(resolveAlias('bungsu Kepri')).toBeNull()
    const note = resolveAlias('ucu')?.note ?? ''
    expect(note).toContain('ms')
    expect(note).toContain('Kepri')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('5. guard glosa tunggal bungsu nihil: hanya komposit adik bungsu di age-axis', () => {
    expect(resolveAlias('bungsu')).toBeNull()
    expect(KINSHIP_ALIASES['bungsu']).toBeUndefined()
  })

  it('6. non-regresi sibling live: etek teteh dan tetangga klaster sibling tetap kind sama', () => {
    expect(resolveAlias('etek')?.kind).toBe('parent-sibling')
    expect(resolveAlias('teteh')?.kind).toBe('sibling')
    expect(resolveAlias('kaka')?.kind).toBe('sibling')
    expect(resolveAlias('dik')?.kind).toBe('sibling')
    expect(resolveAlias('mbak')?.kind).toBe('sibling')
  })

  it('7. guard bump total key: Object.keys(KINSHIP_ALIASES) dan aliasKinds PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(116)
    expect(aliasKinds().length).toBe(116)
  })

  it('8. anti-dup: ucu tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'ucu')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['ucu']).toBeUndefined()
    }
  })

  it('9. negatif homonim: cucu tetap grandchild tidak tertukar ucu, typo nihil, normalisasi kapital', () => {
    expect(resolveAlias('cucu')?.kind).toBe('grandchild')
    expect(resolveAlias('ucux')).toBeNull()
    expect(resolveAlias('UCU')).toEqual(resolveAlias('ucu'))
    expect(resolveAlias('  Ucu ')).toEqual(resolveAlias('ucu'))
  })

  it('10. posisi sisip: ucu tersisip di klaster sibling urutan sort antara turang dan uda', () => {
    const sib = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'sibling')
      .sort()
    expect(sib[sib.length - 3]).toBe('ucu')
    expect(sib[sib.length - 2]).toBe('uda')
    expect(sib[sib.length - 1]).toBe('uni')
    expect(sib.filter((k) => k === 'ucu')).toHaveLength(1)
  })
})
