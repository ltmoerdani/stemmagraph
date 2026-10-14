import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'

/**
 * v253xxviii gelombang 20: acik (Indonesia umum register ark, kind sibling
 * depth 1, dual-source, nihil di src sbg key sebelum entri). Entri masuk map
 * GLOBAL pola makcik; blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key
 * global naik PERSIS 1 (126 jadi 127), klaster sibling depth 1 naik 37 jadi
 * 38.
 *
 * Dua sumber: KBBI III daring mirror kbbi.web.id/acik (acik ark n panggilan
 * untuk perempuan yang lebih tua, seperti kakak perempuan; bibi, satu lema
 * nihil homograf ber nomor, akses 14 Okt 2026 HTTP 200) plus Wiktionary ID
 * pageid 112664 blok bahasa Indonesia identik (arkais, panggilan untuk
 * perempuan yang lebih tua seperti kakak perempuan; bibi, rujukan R:KBBI
 * Daring, flag rfv impor dari KBBI dicatat jujur pola makcik pakde).
 * Guard: blok ljp Lampung (adik perempuan) dan blok ms Rokan Hilir (saudara
 * perempuan dari ayah) di halaman Wiktionary sama BUKAN blok bahasa
 * Indonesia, tidak dipetakan; turunan aci-acikan tidak dibuat key; makna
 * bibi tidak difusi ke key bibi, dua key tetap terpisah pola
 * ponakan-kemenakan; satu lema nihil homograf ber nomor, tidak ada ejaan
 * bertitik. Posisi sisip antara bibi dan uwa.
 * Referensi: kontrak-stg-v253xxviii-acik-2026-10-14 dan Log Supervisi
 * BOARD-stemmagraph 14 Okt 2026.
 */
describe('kinship-aliases acik (v253xxviii, sibling depth 1, register ark Indonesia umum)', () => {
  it('1. entri live: acik di map global, kind sibling, depth 1, tanpa qualifier tanpa region tanpa register', () => {
    const e = KINSHIP_ALIASES['acik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias acik positif, normalisasi kapital dan spasi pinggir', () => {
    const r = resolveAlias('acik')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('ACIK')).toEqual(r)
    expect(resolveAlias(' Acik ')).toEqual(r)
  })

  it('3. kinshipAliasPhrase id dan en untuk acik', () => {
    expect(kinshipAliasPhrase('acik', 'id')).toBe('saudara (1 generasi)')
    expect(kinshipAliasPhrase('acik', 'en')).toBe('sibling (1 generations)')
  })

  it('4. guard blok ljp Lampung (adik perempuan) BUKAN blok bahasa Indonesia, nihil pemetakan', () => {
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'ljp')).toBe(false)
    expect(resolveAlias('adik perempuan')).toBeNull()
  })

  it('5. guard blok ms Rokan Hilir (saudara perempuan dari ayah) BUKAN blok bahasa Indonesia, nihil pemetakan', () => {
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'ms')).toBe(false)
  })

  it('6. guard turunan aci-acikan TIDAK dibuat key, nihil resolve', () => {
    expect(KINSHIP_ALIASES['aci-acikan']).toBeUndefined()
    expect(resolveAlias('aci-acikan')).toBeNull()
  })

  it('7. guard non-difusi: makna bibi pada entri acik TIDAK difusi, key bibi tetap entri parent-sibling terpisah', () => {
    expect(KINSHIP_ALIASES['bibi']).toBeDefined()
    expect(KINSHIP_ALIASES['bibi'].kind).toBe('parent-sibling')
    expect(KINSHIP_ALIASES['acik'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['acik'].note).toContain('bibi')
  })

  it('8. non-regresi tetangga klaster feminin: teteh ucu kak akak sedulur adinda tetap sibling depth 1', () => {
    for (const key of ['teteh', 'ucu', 'kak', 'akak', 'sedulur', 'adinda']) {
      expect(resolveAlias(key)?.kind).toBe('sibling')
      expect(resolveAlias(key)?.depth).toBe(1)
    }
  })

  it('9. guard bump total key: Object.keys dan aliasKinds PERSIS 128 pasca gelombang 21 wak', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(128)
    expect(aliasKinds().length).toBe(128)
  })

  it('10. anti-dup: acik tepat satu kali di map global, nihil di blok regional', () => {
    expect(Object.keys(KINSHIP_ALIASES).filter((k) => k === 'acik')).toHaveLength(1)
  })

  it('11. negatif typo: accik aqik acik2 nihil key nihil resolve', () => {
    expect(KINSHIP_ALIASES['accik']).toBeUndefined()
    expect(resolveAlias('accik')).toBeNull()
    expect(resolveAlias('aqik')).toBeNull()
  })

  it('12. posisi sisip alfabetis: acik di blok a antara bibi dan uwa tidak dipersyaratkan fisik, cukup terverifikasi di blok a', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iAcik = keys.indexOf('acik')
    const iBibi = keys.indexOf('bibi')
    const iUwa = keys.indexOf('uwa')
    expect(iAcik).toBeGreaterThan(-1)
    expect(iBibi).toBeGreaterThan(-1)
    expect(iUwa).toBeGreaterThan(-1)
    expect(iAcik).toBe(iBibi + 1)
  })

  it('13. jangkar dual-source di note: KBBI III mirror plus Wiktionary pageid 112664 tercantum, rfv jujur', () => {
    const note = KINSHIP_ALIASES['acik'].note
    expect(note).toContain('kbbi.web.id/acik')
    expect(note).toContain('112664')
    expect(note).toContain('rfv')
  })
})
