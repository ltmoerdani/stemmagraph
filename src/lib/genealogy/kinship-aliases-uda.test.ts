import { describe, it, expect } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias, aliasKinds } from './kinship-aliases'

/**
 * v253xl gelombang 22: konsolidasi key uda jadi entri GLOBAL dual-source kind
 * sibling depth 1 tanpa qualifier tanpa region. Entri lama v184-i bervalen
 * sunda (notes/427) diganti karena riset ulang sumber resmi menunjukkan lema
 * umum tanpa label daerah. Total key global 126 jadi 127 (acik masuk paralel
 * entri,; nihil penambahan kind; disparitas kontrak 127 jadi 128 dicatat di
 * laporan dan worklog).
 *
 * Jangkar: KBBI VI kbbi.kemendikdasmen.go.id/entri/uda akses 14 Okt 2026
 * HTTP 200 (u.da2 n Mk kakak laki-laki; abang, homograf bernomor dua lema)
 * plus Wiktionary ID oldid 1309472 (blok Bahasa Indonesia nomina: panggilan
 * untuk laki-laki muda, kakak laki-laki; sinonim kakak abang bang dan jv mas).
 * Guard: homograf u.da1 ark Jk kp muda; homonim antarbahasa ljp btm kxd min
 * bts; sinonim abang bang mas hanya glosa; ragam udo; lihat pemuda.
 * Referensi: kontrak-stg-v253xl-uda-2026-10-14 dan Log Supervisi
 * BOARD-stemmagraph 14 Okt 2026.
 */
describe('kinship-aliases uda (v253xl, sibling depth 1, entri global dual-source)', () => {
  it('1. entri live global: kind sibling, depth 1, tanpa qualifier tanpa region tanpa register', () => {
    const e = KINSHIP_ALIASES['uda']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias uda positif tanpa region, label kanonik konsisten sibling 1 generasi', () => {
    const r = resolveAlias('uda')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('UDA')).toEqual(r)
    expect(resolveAlias(' Uda ')).toEqual(r)
  })

  it('3. negasi homograf KBBI u.da1: muda ark Jk kp bukan relasi, nihil key; komposit pak uda tetap key Karo parent terpisah', () => {
    expect(KINSHIP_ALIASES['muda']).toBeUndefined()
    expect(resolveAlias('muda')).toBeNull()
    const pakUda = resolveAlias('pak uda', 'Karo')
    expect(pakUda).not.toBeNull()
    expect(pakUda?.kind).toBe('parent')
    expect(resolveAlias('pak uda')).toBeNull()
  })

  it('4. negasi blok ljp Lampung (adik perempuan) BUKAN blok bahasa Indonesia, nihil pemetakan', () => {
    expect(resolveAlias('adik perempuan')).toBeNull()
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'ljp')).toBe(false)
  })

  it('5. negasi blok btm Batak Toba BUKAN blok bahasa Indonesia, nihil pemetakan', () => {
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'btm')).toBe(false)
  })

  it('6. negasi blok kxd Kelabit (urutan kelima di halaman Wiktionary) BUKAN blok bahasa Indonesia', () => {
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'kxd')).toBe(false)
  })

  it('7. negasi blok min Minangkabau dan bts Simalungun di halaman sama, nihil pemetakan', () => {
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'min')).toBe(false)
    expect(Object.values(KINSHIP_ALIASES).some((e) => e.qualifier === 'bts')).toBe(false)
  })

  it('8. negasi sinonim: bang mas key global, abang key global DUAL-SOURCE independen sejak v255 gel28 (bukan difusi dari uda, guard sinonim note tetap sah), abang Simalungun tetap regional', () => {
    expect(KINSHIP_ALIASES['bang']).toBeDefined()
    expect(KINSHIP_ALIASES['mas']).toBeDefined()
    expect(KINSHIP_ALIASES['abang']).toBeDefined()
    expect(resolveAlias('abang')?.kind).toBe('sibling')
    expect(resolveAlias('mas')?.region).toBe('Jawa')
    expect(resolveAlias('abang', 'Simalungun')).not.toBeNull()
    expect(resolveAlias('abang', 'Simalungun')?.region).toBe('Simalungun')
    expect(KINSHIP_ALIASES['uda'].note).toContain('GUARD SINONIM')
  })

  it('9. negasi ragam udo: TIDAK dibuat key, nihil resolve', () => {
    expect(KINSHIP_ALIASES['udo']).toBeUndefined()
    expect(resolveAlias('udo')).toBeNull()
  })

  it('10. negasi lihat pemuda: nihil key nihil resolve', () => {
    expect(KINSHIP_ALIASES['pemuda']).toBeUndefined()
    expect(resolveAlias('pemuda')).toBeNull()
  })

  it('11. posisi alfabetis blok u: uda sebelum uwa, tetap di ekor klaster sibling setelah ucu', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys.indexOf('uda')).toBeGreaterThan(-1)
    expect(keys.indexOf('uda')).toBeLessThan(keys.indexOf('uwa'))
    const sib = keys.filter((k) => KINSHIP_ALIASES[k]?.kind === 'sibling').sort()
    expect(sib[sib.length - 3]).toBe('uda')
    expect(sib.filter((k) => k === 'uda')).toHaveLength(1)
  })

  it('12. guard global: acik masuk paralel, total key kini 131 pasca v253xlii putra putri, naik dari 129 v253xli ading, sebelumnya 128 gelombang 21 wak', () => {
    expect(aliasKinds().length).toBe(143)
  })
})
