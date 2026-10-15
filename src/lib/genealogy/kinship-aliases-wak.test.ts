import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'

/**
 * v253xxxix gelombang 21: wak (Jambi dan Banyuwangi, kakak dari ayah atau
 * ibu, padanan uwak, kind parent-sibling depth 1, tanpa qualifier tanpa
 * region, nihil di src sbg key sebelum entri). Entri masuk map GLOBAL pola
 * uwa; blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key global naik
 * PERSIS 1 (127 jadi 128), klaster parent-sibling naik 21 jadi 22.
 *
 * Dua sumber: KBBI III daring mirror kbbi.web.id/wak (wak1 n kp uwak,
 * kiasan uwak, satu lema nihil homograf ber nomor, akses 14 Okt 2026 HTTP
 * 200) plus Wiktionary ID pageid 47385 tiga blok daerah ber-rujukan (jax
 * kakak dari orang tua baik paman maupun bibi dgn turunan wakmuk wakendek
 * wakning waktam waktih rujukan Kamus Bahasa Jambi; mui-plm lebih tua dari
 * orang tua; osi uwak rujukan Ali 2002 Kamus Bahasa Daerah Using-Indonesia
 * Banyuwangi), blok id nihil dicatat jujur pola preseden bako (blok daerah
 * tetap sah bila ber-rujukan terbitan resmi).
 * Guard: polisemi wak2 suara itik dan katak (tiruan bunyi) tidak dipetakan;
 * turunan blok jax wakmuk wakendek wakning waktam waktih tidak dibuat key;
 * varian ejaan uwak dan uak tetap ditahan nihil sbg key, uwak sudah
 * diwakili uwa live; homonim antarbahasa di halaman Wiktionary sama tidak
 * dipetakan. Posisi sisip antara uwa dan om.
 * Referensi: kontrak-stg-v253xxxix-wak-2026-10-14 dan Log Supervisi
 * BOARD-stemmagraph 14 Okt 2026.
 */
describe('kinship-aliases wak (v253xxxix, parent-sibling depth 1, Jambi Banyuwangi)', () => {
  it('1. entri live: wak di map global, kind parent-sibling, depth 1, tanpa qualifier tanpa region tanpa register', () => {
    const e = KINSHIP_ALIASES['wak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias wak positif, normalisasi kapital dan spasi pinggir', () => {
    const r = resolveAlias('wak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('WAK')).toEqual(r)
    expect(resolveAlias(' Wak ')).toEqual(r)
  })

  it('3. kinshipAliasPhrase id dan en untuk wak', () => {
    expect(kinshipAliasPhrase('wak', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('wak', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('4. guard polisemi: wak2 suara itik dan katak (tiruan bunyi) BUKAN relasi kekerabatan, nihil pemetakan', () => {
    expect(KINSHIP_ALIASES['wak2']).toBeUndefined()
    expect(resolveAlias('suara itik')).toBeNull()
    expect(resolveAlias('katak')).toBeNull()
  })

  it('5. guard turunan blok jax: wakmuk wakendek wakning waktam waktih TIDAK dibuat key, nihil resolve', () => {
    for (const k of ['wakmuk', 'wakendek', 'wakning', 'waktam', 'waktih']) {
      expect(KINSHIP_ALIASES[k]).toBeUndefined()
      expect(resolveAlias(k)).toBeNull()
    }
  })

  it('6. guard varian ejaan: uwak dan uak TETAP DITAHAN nihil sbg key, uwak diwakili uwa live', () => {
    expect(KINSHIP_ALIASES['uwak']).toBeUndefined()
    expect(KINSHIP_ALIASES['uak']).toBeUndefined()
    expect(resolveAlias('uwak')).toBeNull()
    expect(resolveAlias('uak')).toBeNull()
    expect(KINSHIP_ALIASES['uwa']).toBeDefined()
    expect(KINSHIP_ALIASES['uwa'].kind).toBe('parent-sibling')
  })

  it('7. guard non-difusi: wak dan uwa dua key terpisah, keduanya parent-sibling depth 1', () => {
    expect(KINSHIP_ALIASES['wak'].note).toContain('uwak')
    expect(KINSHIP_ALIASES['uwa'].note).not.toBe(KINSHIP_ALIASES['wak'].note)
  })

  it('8. non-regresi klaster parent-sibling: uwa om pakcik pakde paman bibi tetap parent-sibling depth 1', () => {
    for (const key of ['uwa', 'om', 'pakcik', 'pakde', 'paman', 'bibi']) {
      expect(resolveAlias(key)?.kind).toBe('parent-sibling')
      expect(resolveAlias(key)?.depth).toBe(1)
    }
  })

  it('9. guard bump total key: Object.keys dan aliasKinds PERSIS 131 pasca v253xlii putra putri, naik dari 129 v253xli ading, sebelumnya 128 gelombang 21', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(136)
    expect(aliasKinds().length).toBe(136)
  })

  it('10. anti-dup: wak tepat satu kali di map global, nihil di blok regional', () => {
    expect(Object.keys(KINSHIP_ALIASES).filter((k) => k === 'wak')).toHaveLength(1)
  })

  it('11. negatif typo: wakk wak1 waak nihil key nihil resolve', () => {
    expect(KINSHIP_ALIASES['wakk']).toBeUndefined()
    expect(resolveAlias('wakk')).toBeNull()
    expect(resolveAlias('wak1')).toBeNull()
  })

  it('12. klaster parent-sibling kini 22 anggota termasuk wak', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toContain('wak')
    expect(ps).toHaveLength(22)
  })

  it('13. jangkar dual-source di note: KBBI III mirror kbbi.web.id/wak plus Wiktionary pageid 47385 tercantum, blok id nihil dicatat jujur', () => {
    const note = KINSHIP_ALIASES['wak'].note
    expect(note).toContain('kbbi.web.id/wak')
    expect(note).toContain('47385')
    expect(note).toContain('blok id nihil')
  })
})
