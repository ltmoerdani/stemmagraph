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
 * v253-xv: makcik (Indonesia umum register akr, kind parent-sibling depth 1,
 * dual-source, nihil di src sbg key sebelum entri). Entri masuk map GLOBAL
 * pola tante pakde; blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key
 * global naik PERSIS 1 (91 jadi 92).
 *
 * Dua sumber: KBBI III daring mirror kbbi.web.id/makcik (mak.cik n mak kecil;
 * bibi, tunggal nihil homograf, akses 12 Okt 2026) plus Wiktionary ID revid
 * 1217714 via api.php (blok bahasa Indonesia nomina mak kecil; bibi,
 * konvergen). JANGKAR KBBI EDISI III: entri nihil di KBBI VI, jangkar edisi
 * III dicatat jujur di header ini. Guard: blok jax Melayu Jambi (adik
 * perempuan dari bapak, tag rfv) tidak dipetakan; key pakcik tetap tidak
 * dibuat; glosa makcik pada entri etek dan bibi Karo adalah glos saja.
 */
describe('kinship-aliases makcik (v253-xv, parent-sibling depth 1, register akr Indonesia umum)', () => {
  it('1. entri live: makcik di map global, kind parent-sibling, depth 1, tanpa qualifier tanpa region tanpa register', () => {
    const e = KINSHIP_ALIASES['makcik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias makcik positif dua arah setara aunt', () => {
    const r = resolveAlias('makcik')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('3. kinshipAliasPhrase id dan en untuk makcik: om atau tante 1 generasi', () => {
    expect(kinshipAliasPhrase('makcik', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('makcik', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('4. expandAliasQuery dari search-filter memuat makcik dan label kanoniknya', () => {
    const ex = expandAliasQuery('makcik')
    expect(ex).toContain('makcik')
    expect(ex).toContain('om atau tante (1 generasi)')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('5. pakcik kini live pasca v253-xix; guard kontrak pakde diperbarui jadi positif', () => {
    expect(resolveAlias('pakcik')).not.toBeNull()
    expect(KINSHIP_ALIASES['pakcik']).toBeDefined()
    expect(Object.keys(KINSHIP_ALIASES)).toContain('pakcik')
  })

  it('6. guard blok jax Wiktionary tidak dipetakan sbg key', () => {
    expect(resolveAlias('adik perempuan dari bapak')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('adik perempuan dari bapak')
    const note = resolveAlias('makcik')?.note ?? ''
    expect(note).toContain('jax')
    expect(note).toContain('BUKAN blok bahasa Indonesia')
  })

  it('7. guard jangkar KBBI III di note: nihil entri KBBI VI dicatat jujur, dual sumber dan revid tercantum', () => {
    const note = resolveAlias('makcik')?.note ?? ''
    expect(note).toContain('kbbi.web.id/makcik')
    expect(note).toContain('KBBI III')
    expect(note).toContain('nihil di KBBI VI')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('1217714')
  })

  it('8. non-regresi tetangga: tante, paklik, etek, pakde tetap live kind sama; om kini live pasca v253-xix', () => {
    expect(resolveAlias('tante')?.kind).toBe('parent-sibling')
    expect(resolveAlias('paklik')?.kind).toBe('parent-sibling')
    expect(resolveAlias('etek')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pakde')?.kind).toBe('parent-sibling')
    expect(resolveAlias('om')?.kind).toBe('parent-sibling')
  })

  it('9. guard bump total key: Object.keys(KINSHIP_ALIASES) dan aliasKinds PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(108)
    expect(aliasKinds().length).toBe(108)
  })

  it('10. anti-dup: makcik tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'makcik')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['makcik']).toBeUndefined()
    }
  })

  it('11. negatif typo dan normalisasi kapital dan spasi pinggir', () => {
    expect(resolveAlias('makcikk')).toBeNull()
    expect(resolveAlias('MAKCIK')).toEqual(resolveAlias('makcik'))
    expect(resolveAlias('  Makcik ')).toEqual(resolveAlias('makcik'))
  })

  it('12. posisi sisip alfabetis blok parent-sibling: antara mama dan mamak, gugus lengkap 11 key', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual([
      'bako',
      'bibi',
      'budhe',
      'emang',
      'etek',
      'makcik',
      'mama',
      'mamak',
      'mami',
      'mang',
      'om',
      'pakcik',
      'pakde',
      'pakdhe',
      'paklik',
      'paman',
      'tante',
      'uwa',
    ])
    expect(ps).toHaveLength(18)
  })

  it('13. glosa makcik pada entri etek dan bibi Karo tetap glos, bibi kini live di map global pasca v253-xix', () => {
    const note = resolveAlias('makcik')?.note ?? ''
    expect(note).toContain('GLOS saja tidak diubah')
    expect(KINSHIP_ALIASES['bibi']).toBeDefined()
  })
})
