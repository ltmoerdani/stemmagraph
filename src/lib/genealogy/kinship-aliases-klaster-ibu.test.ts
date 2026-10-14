import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'

/**
 * v253-xvii: klaster ibu, 2 key baru nyak dan mbok (kontrak PM v253-xvii
 * revisi 11 Okt 2026: amak gugur anti-dup karena sudah live pasca v253-xi,
 * apek ditunda single-source). Nyak Jk semantik tunggal ibu, label Jk di
 * note karena jk nihil di union qualifier. Mbok Jw semantik utama ibu,
 * dua makna sapaan lain hanya note, mbok2 Bl dan blok ban tidak dipetakan.
 * Total key global naik PERSIS 2 (93 jadi 95).
 */
describe('kinship-aliases klaster ibu nyak mbok (v253-xvii, parent depth 1)', () => {
  it('1. entri nyak live: kind parent, depth 1, region Jambi, nihil qualifier', () => {
    const e = KINSHIP_ALIASES['nyak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Jambi')
    expect(e.qualifier).toBeUndefined()
  })

  it('2. resolveAlias nyak positif kind parent, normalisasi huruf besar dan spasi pinggir', () => {
    const r = resolveAlias('nyak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('NYAK')).toEqual(r)
    expect(resolveAlias('  Nyak ')).toEqual(r)
  })

  it('3. note nyak: label Jk verbatim, glosa ibu, status sumber revid 1347330 dan tanggal akses', () => {
    const note = KINSHIP_ALIASES['nyak']?.note ?? ''
    expect(note).toContain('Jk')
    expect(note).toContain('ibu')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/nyak')
    expect(note).toContain('revid 1347330')
    expect(note).toContain('12 Okt 2026')
    expect(note).toContain('api.php')
  })

  it('4. guard homograf nyak: pronomina kge ljp dan verba osi tidak dipetakan, note mencatat guard', () => {
    const note = KINSHIP_ALIASES['nyak']?.note ?? ''
    expect(note).toContain('GUARD HOMOGRAF')
    expect(note).toContain('kge')
    expect(note).toContain('ljp')
    expect(note).toContain('osi')
    expect(resolveAlias('saya')).toBeNull()
    expect(resolveAlias('aku')).toBeNull()
    expect(resolveAlias('terimalah')).toBeNull()
  })

  it('5. entri mbok live: kind parent, depth 1, qualifier jw, region Jawa', () => {
    const e = KINSHIP_ALIASES['mbok']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
  })

  it('6. resolveAlias mbok positif kind parent, normalisasi huruf besar dan spasi pinggir', () => {
    const r = resolveAlias('mbok')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
    expect(resolveAlias('MBOK')).toEqual(r)
    expect(resolveAlias('  Mbok ')).toEqual(r)
  })

  it('7. note mbok: semantik utama ibu, dua makna sapaan hanya note, status sumber revid 1220974 dan akses', () => {
    const note = KINSHIP_ALIASES['mbok']?.note ?? ''
    expect(note).toContain('ibu')
    expect(note).toContain('sapaan')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/mbok')
    expect(note).toContain('revid 1220974')
    expect(note).toContain('12 Okt 2026')
    expect(note).toContain('mbok2')
    expect(note).toContain('Bl')
  })

  it('8. guard homograf mbok: mbok2 Bl sapaan dan blok ban kakak perempuan tidak dipetakan', () => {
    const note = KINSHIP_ALIASES['mbok']?.note ?? ''
    expect(note).toContain('GUARD HOMOGRAF')
    expect(note).toContain('ban')
    expect(note).toContain('kakak perempuan')
    expect(Object.keys(KINSHIP_ALIASES).filter((k) => k === 'mbok')).toHaveLength(1)
    expect(KINSHIP_ALIASES['simbok']).toBeUndefined()
    expect(KINSHIP_ALIASES['embok']).toBeUndefined()
    expect(KINSHIP_ALIASES['mbok ajeng']).toBeUndefined()
  })

  it('9. kasus lintas: nyak dan mbok keduanya parent dan tidak saling menimpa', () => {
    const nyak = resolveAlias('nyak')
    const mbok = resolveAlias('mbok')
    expect(nyak).not.toBeNull()
    expect(mbok).not.toBeNull()
    expect(nyak).not.toBe(mbok)
    expect(nyak?.kind).toBe('parent')
    expect(mbok?.kind).toBe('parent')
    expect(nyak?.region).toBe('Jambi')
    expect(mbok?.region).toBe('Jawa')
  })

  it('10. non-regresi gugus ibu existing: amak tetap parent Minangkabau, bapa tetap parent Karo, kanonik ibu emak bunda nihil alias', () => {
    expect(resolveAlias('amak')?.kind).toBe('parent')
    expect(KINSHIP_ALIASES['amak']?.qualifier).toBe('minangkabau')
    expect(resolveAlias('bapa')?.kind).toBe('parent')
    expect(resolveAlias('bapa')?.region).toBe('Karo')
    expect(resolveAlias('ibu')).toBeNull()
    expect(resolveAlias('emak')).toBeNull()
    expect(resolveAlias('bunda')).toBeNull()
  })

  it('11. guard bump total key: Object.keys dan aliasKinds PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
    expect(aliasKinds().length).toBe(133)
  })

  it('12. anti-dup: nyak dan mbok masing-masing tepat satu kali, nihil key duplikat', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys.filter((k) => k === 'nyak')).toHaveLength(1)
    expect(keys.filter((k) => k === 'mbok')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('13. daftar kind parent global naik jadi 7 pasca gelombang 19 (mandeh), urutan asli map', () => {
    const parents = Object.keys(KINSHIP_ALIASES).filter(
      (k) => KINSHIP_ALIASES[k]?.kind === 'parent',
    )
    expect(parents).toEqual(['amak', 'nyak', 'mbok', 'nyokap', 'bokap', 'bapa', 'mandeh'])
  })

  it('14. nyak dan mbok nihil di semua map regional, parent-sibling global naik jadi 18 pasca v253-xxi (uwa)', () => {
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['nyak']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['mbok']).toBeUndefined()
    }
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual(['bako', 'bibi', 'bude', 'budhe', 'bulik', 'emang', 'engku', 'etek', 'makcik', 'mama', 'mamak', 'mami', 'mang', 'om', 'pakcik', 'pakde', 'pakdhe', 'paklik', 'paman', 'tante', 'uwa', 'wak'])
  })
})
