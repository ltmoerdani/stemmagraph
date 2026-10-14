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
 * V253-XX: bank lemma pakdhe, budhe, ponakan (kontrak PM, 12 Okt 2026).
 * Tiga lema masuk map GLOBAL pola pakde paklik makcik; blok
 * KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key global naik PERSIS 3
 * (100 jadi 103 di V253-XX; 103 jadi 106 di V253-XXI: uwa nyokap bokap).
 *
 * pakdhe: jangkar Wiktionary ID blok bahasa Tengger revid 1286612 (nomina
 * kakak laki-laki orang tua); KBBI VI dan mirror III NIHIL entri, dicatat
 * jujur pola makcik. Varian pakde tetap key KBBI terpisah, tidak difusi.
 *
 * budhe: jangkar KBBI VI bu.de n Jw (ibu gede; kakak perempuan ibu atau
 * ayah) akses 12 Okt 2026 plus Wiktionary ID revid 1165956 blok bahasa
 * Indonesia konvergen; halaman budhe nihil di KBBI VI dan mirror III,
 * key dibuat pada ejaan budhe sesuai kontrak PM, ejaan bu.de tidak
 * dibuat sbg key (varian ortografik). Makna 2 KBBI sapaan tidak dipetakan
 * terpisah (kind sama, hanya note). Homonim blok nia Nias (canda,
 * kelakar) di halaman Wiktionary bude TIDAK dipetakan.
 *
 * ponakan: jangkar KBBI VI po.nak.an n cak kemenakan plus Wiktionary ID
 * revid 1462863 blok bahasa Indonesia konvergen (cak kemenakan). Blok
 * bew Bekasi dan mui-plm Palembang di halaman sama BUKAN blok bahasa
 * Indonesia, TIDAK dipetakan. Kemenakan tetap key tersendiri live.
 */
describe('kinship-aliases bank lemma pakdhe budhe ponakan (V253-XX)', () => {
  it('1. entri live: pakdhe di map global, kind parent-sibling, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['pakdhe']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
    expect(e.register).toBeUndefined()
  })

  it('2. entri live: budhe di map global, kind parent-sibling, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['budhe']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
    expect(e.register).toBeUndefined()
  })

  it('3. entri live: ponakan di map global, kind sibling-child, qualifier cak, tanpa depth', () => {
    const e = KINSHIP_ALIASES['ponakan']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling-child')
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBe('cak')
    expect(e.region).toBeUndefined()
  })

  it('4. resolveAlias positif ketiga key, normalisasi huruf besar dan spasi pinggir', () => {
    const p = resolveAlias('pakdhe')
    const b = resolveAlias('budhe')
    const o = resolveAlias('ponakan')
    expect(p).not.toBeNull()
    expect(b).not.toBeNull()
    expect(o).not.toBeNull()
    expect(resolveAlias('PAKDHE')).toEqual(p)
    expect(resolveAlias('  Budhe ')).toEqual(b)
    expect(resolveAlias('PONAKAN')).toEqual(o)
  })

  it('5. resolveAlias dengan region lain tetap resolve via global (fallback blok nihil)', () => {
    expect(resolveAlias('pakdhe', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('budhe', 'Minangkabau')?.kind).toBe('parent-sibling')
    expect(resolveAlias('ponakan', 'Jawa')?.kind).toBe('sibling-child')
  })

  it('6. kinshipAliasPhrase id dan en: gugus paman bibi depth 1 dan keponakan', () => {
    expect(kinshipAliasPhrase('pakdhe', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('pakdhe', 'en')).toBe('uncle or aunt (1 generations)')
    expect(kinshipAliasPhrase('budhe', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('budhe', 'en')).toBe('uncle or aunt (1 generations)')
    expect(kinshipAliasPhrase('ponakan', 'id')).toBe('keponakan')
    expect(kinshipAliasPhrase('ponakan', 'en')).toBe('nephew or niece')
  })

  it('7. expandAliasQuery dari search-filter memuat ketiga key', () => {
    expect(expandAliasQuery('pakdhe')).toContain('om atau tante (1 generasi)')
    expect(expandAliasQuery('budhe')).toContain('om atau tante (1 generasi)')
    expect(expandAliasQuery('ponakan')).toContain('keponakan')
  })

  it('8. note pakdhe memuat jangkar revid 1286612 blok Tengger dan kejujuran KBBI nihil', () => {
    const note = resolveAlias('pakdhe')?.note ?? ''
    expect(note).toContain('1286612')
    expect(note).toContain('Tengger')
    expect(note).toContain('kakak laki-laki')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('ENTRI NIHIL')
  })

  it('9. note budhe memuat jangkar bu.de KBBI VI dan revid 1165956, guard homonim nia', () => {
    const note = resolveAlias('budhe')?.note ?? ''
    expect(note).toContain('bu.de')
    expect(note).toContain('ibu gede')
    expect(note).toContain('1165956')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('nia')
  })

  it('10. note ponakan memuat po.nak.an KBBI VI dan revid 1462863, guard blok bew dan mui-plm', () => {
    const note = resolveAlias('ponakan')?.note ?? ''
    expect(note).toContain('po.nak.an')
    expect(note).toContain('kemenakan')
    expect(note).toContain('1462863')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('bew')
    expect(note).toContain('mui-plm')
  })

  it('11. anti-dup: ketiga key muncul tepat satu kali, nihil di semua blok regional', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'pakdhe')).toHaveLength(1)
    expect(all.filter((k) => k === 'budhe')).toHaveLength(1)
    expect(all.filter((k) => k === 'ponakan')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['pakdhe']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['budhe']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['ponakan']).toBeUndefined()
    }
  })

  it('12. guard bump total key: Object.keys(KINSHIP_ALIASES) dan aliasKinds PERSIS 126 pasca gelombang 19 (riwayat 106 jadi 123 di V253-XXI, 123 jadi 126 di gelombang 19)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(126)
    expect(aliasKinds().length).toBe(126)
  })

  it('13. gugus parent-sibling Jawa jadi 6 entri: pakde paklik pakdhe budhe bude bulik', () => {
    const entries = Object.values(KINSHIP_ALIASES).filter(
      (e) => e.kind === 'parent-sibling' && e.region === 'Jawa' && e.qualifier === 'jw',
    )
    expect(entries).toHaveLength(6)
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toContain('budhe')
    expect(ps).toContain('pakdhe')
    expect(ps.indexOf('bibi')).toBeLessThan(ps.indexOf('budhe'))
    expect(ps.indexOf('budhe')).toBeLessThan(ps.indexOf('emang'))
  })

  it('14. varian ejaan tetap terpisah: pakde tidak difusi ke pakdhe, bu.de nihil sbg key, bude live parent-sibling, kemenakan tetap live', () => {
    expect(KINSHIP_ALIASES['pakde']).toBeDefined()
    expect(resolveAlias('pakdhe')).not.toEqual(resolveAlias('pakde'))
    expect(KINSHIP_ALIASES['bu.de']).toBeUndefined()
    expect(resolveAlias('bude')).not.toBeNull()
    expect(resolveAlias('bude')?.kind).toBe('parent-sibling')
    expect(resolveAlias('bude')?.depth).toBe(1)
    expect(resolveAlias('bude')?.region).toBe('Jawa')
    expect(KINSHIP_ALIASES['kemenakan']).toBeDefined()
    expect(resolveAlias('kemenakan')?.kind).toBe('sibling-child')
  })

  it('15. negatif: typo nihil dan varian tanteh tetap nihil, ponakan bukan child', () => {
    expect(resolveAlias('pakdhee')).toBeNull()
    expect(resolveAlias('budhee')).toBeNull()
    expect(resolveAlias('ponakann')).toBeNull()
    expect(resolveAlias('pakdhe')?.kind).not.toBe('child')
  })

  it('16. relasi terbalik pakdhe dan budhe: parent-sibling berhadapan dengan sibling-child di map', () => {
    expect(resolveAlias('pakdhe')?.kind).toBe('parent-sibling')
    expect(resolveAlias('budhe')?.kind).toBe('parent-sibling')
    expect(resolveAlias('ponakan')?.kind).toBe('sibling-child')
    expect(resolveAlias('keponakan')?.kind).toBe('sibling-child')
    expect(resolveAlias('kemenakan')?.kind).toBe('sibling-child')
    expect(resolveAlias('pakdhe')?.kind).not.toBe(resolveAlias('ponakan')?.kind)
    expect(resolveAlias('budhe')?.kind).not.toBe(resolveAlias('kemenakan')?.kind)
  })

  it('17. relasi terbalik ponakan: sibling-child berhadapan dengan parent-sibling (bibi om pakcik)', () => {
    expect(resolveAlias('ponakan')?.depth).toBeUndefined()
    for (const k of ['bibi', 'pakcik', 'om', 'emang']) {
      const e = resolveAlias(k)
      if (e) expect(e.kind).toBe('parent-sibling')
    }
    expect(resolveAlias('ponakan')?.kind).not.toBe(resolveAlias('bibi')?.kind)
  })

  it('18. edge polysemy: pakdhe vs pakde paklik beda key; budhe vs bu bibi; ponakan vs anak', () => {
    expect(KINSHIP_ALIASES['pakdhe']).not.toBe(KINSHIP_ALIASES['pakde'])
    expect(KINSHIP_ALIASES['paklik']).toBeDefined()
    expect(resolveAlias('pakdhe')).not.toEqual(resolveAlias('paklik'))
    expect(KINSHIP_ALIASES['bu']).toBeUndefined()
    expect(resolveAlias('bu')).toBeNull()
    expect(KINSHIP_ALIASES['bibi']).toBeDefined()
    expect(resolveAlias('budhe')).not.toEqual(resolveAlias('bibi'))
    expect(resolveAlias('anak')?.kind).toBe('child')
    expect(resolveAlias('ponakan')?.kind).toBe('sibling-child')
    expect(resolveAlias('ponakan')).not.toEqual(resolveAlias('anak'))
  })
})
