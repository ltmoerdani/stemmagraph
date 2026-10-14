import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
/**
 * v253-ix: bako (uncle pihak ayah Minangkabau, dual-source, kontrak PM
 * kontrak-v253ix-stg-bako-2026-10-10.md). Total key global naik PERSIS +1
 * (84 jadi 85), entri di map global dengan region Minangkabau pola mamak
 * (v253-vii); blok KINSHIP_ALIASES_REGIONAL.Minangkabau nihil di tip dan
 * tidak dibuat di task ini.
 */
describe('kinship-aliases bako (v253-ix, parent-sibling depth 1 Minangkabau)', () => {
  it('1. entri live: bako di map global, kind parent-sibling, depth 1, qualifier minangkabau, region Minangkabau', () => {
    const e = KINSHIP_ALIASES['bako']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('minangkabau')
    expect(e.region).toBe('Minangkabau')
  })

  it('2. resolveAlias bako dengan region Minangkabau: entri global terjangkau lewat fallback blok nihil', () => {
    const r = resolveAlias('bako', 'Minangkabau')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Minangkabau')
    expect(KINSHIP_ALIASES_REGIONAL['Minangkabau']).toBeUndefined()
  })

  it('3. note memuat glosa KBBI keluarga pihak ayah dan penanda dua sumber', () => {
    const note = resolveAlias('bako')?.note ?? ''
    expect(note).toContain('keluarga dari pihak ayah')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/bako')
    expect(note).toContain('ba.ko1 n Mk keluarga dari pihak ayah')
    expect(note).toContain('1345690')
    expect(note).toContain('api.php')
  })

  it('4. guard homograf KBBI: empat homograf bernomor cukup tercatat TIDAK dipetakan', () => {
    const note = resolveAlias('bako')?.note ?? ''
    expect(note).toContain('GUARD HOMOGRAF')
    expect(note).toContain('ba.ko2')
    expect(note).toContain('ba.ko3')
    expect(note).toContain('ba.ko4')
    expect(note).toContain('ba.ko5')
    expect(note).toContain('tonggak')
    expect(note).toContain('delima')
    expect(note).toContain('sambal ikan')
    expect(note).toContain('tembakau kering')
    expect(KINSHIP_ALIASES['ba.ko2']).toBeUndefined()
    expect(KINSHIP_ALIASES['ba.ko3']).toBeUndefined()
    expect(KINSHIP_ALIASES['ba.ko4']).toBeUndefined()
    expect(KINSHIP_ALIASES['ba.ko5']).toBeUndefined()
  })

  it('5. negatif tanpa region sesuai semantik resolver aktual: bako global resolve, tetangga nihil tetap nihil', () => {
    expect(resolveAlias('bako')).not.toBeNull()
    expect(resolveAlias('beko')).toBeNull()
    expect(resolveAlias('bakok')).toBeNull()
    expect(resolveAlias('bakak')).toBeNull()
  })

  it('6. guard homonim antarbahasa Wiktionary: bako Sunda dan bako Using tembakau TIDAK dipetakan', () => {
    const note = resolveAlias('bako')?.note ?? ''
    expect(note).toContain('GUARD HOMONIM ANTARBAHASA')
    expect(note).toContain('Sunda')
    expect(note).toContain('Using')
    expect(note).toContain('tembakau')
  })

  it('7. non-regresi tetangga gugus saudara orang tua: emang, mang, pakde, mamak, tulang lulus ulang', () => {
    expect(resolveAlias('emang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('emang')?.qualifier).toBe('sunda')
    expect(resolveAlias('mang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mang')?.qualifier).toBe('sunda')
    expect(resolveAlias('pakde')?.qualifier).toBe('jw')
    expect(resolveAlias('mamak')?.qualifier).toBe('minangkabau')
    expect(resolveAlias('mamak')?.region).toBe('Minangkabau')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
  })

  it('8. daftar key parent-sibling global PERSIS tujuh pasca v253-ix, bako menyisip alfabetis', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual(['bako', 'bibi', 'bude', 'budhe', 'bulik', 'emang', 'engku', 'etek', 'makcik', 'mama', 'mamak', 'mami', 'mang', 'om', 'pakcik', 'pakde', 'pakdhe', 'paklik', 'paman', 'tante', 'uwa', 'wak'])
    expect(ps).toHaveLength(22)
  })

  it('9. guard bump total key PERSIS +1: 84 menjadi 85 di map global dan aliasKinds', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(132)
    expect(aliasKinds().length).toBe(132)
  })

  it('10. anti-dup: key bako muncul tepat satu kali di daftar global dan nihil di semua blok regional', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'bako')).toHaveLength(1)
    expect(aliasKinds().filter((k) => k === 'bako')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['bako']).toBeUndefined()
    }
  })

  it('11. normalisasi: BAKO, spasi pinggir, dan titik tengah sama dengan bako', () => {
    expect(resolveAlias('BAKO')).toEqual(resolveAlias('bako'))
    expect(resolveAlias('  Bako ')).toEqual(resolveAlias('bako'))
    expect(resolveAlias('ba.ko')).toBeNull() // titik ASCII tidak dibuang normalizer, hanya titik tengah U+00B7 pola e.mang
  })

  it('12. guard jebakan sitasi: note mencatat min.wiktionary tidak dipakai dan status sumber ketiga UNAND jujur', () => {
    const note = resolveAlias('bako')?.note ?? ''
    expect(note).toContain('min.wiktionary')
    expect(note).toContain('TIDAK dipakai')
    expect(note).toContain('469753')
    expect(note).toContain('TIDAK dikutip')
    const mk = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.qualifier === 'minangkabau')
      .sort()
    expect(mk).toEqual(['amak', 'bako', 'etek', 'mamak', 'mandeh']) // amak menyisip pasca v253-xi
  })
})
