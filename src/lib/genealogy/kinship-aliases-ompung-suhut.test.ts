import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases ompung suhut Toba (v206-i, komposit grandparent, tiga jangkar)', () => {
  it('1. resolveAlias ompung suhut region Toba kembalikan grandparent depth 2 region Toba', () => {
    const r = resolveAlias('ompung suhut', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(2)
    expect(r?.region).toBe('Toba')
  })

  it('2. note memuat dua DOI dan jejak kamusbatak', () => {
    expectNoteContains('Toba', 'ompung suhut', [
      '10.24164/pw.v8i2.309',
      '10.30762/asketik.v8i1.1433',
      'kamusbatak',
    ])
  })

  it('3. note menyebut TIGA JANGKAR independen', () => {
    expect(regionalNote('Toba', 'ompung suhut')).toContain('TIGA JANGKAR independen')
  })

  it('4. negatif pengunci komposit: suhut, ompung, dan tanpa region bernilai null', () => {
    expect(resolveAlias('suhut', 'Toba')).toBeNull()
    expect(resolveAlias('ompung', 'Toba')).toBeNull()
    expect(resolveAlias('ompung suhut')).toBeNull()
  })

  it('5. homonim: region Karo null, uppercase sama dengan lowercase', () => {
    expect(resolveAlias('ompung suhut', 'Karo')).toBeNull()
    expect(resolveAlias('OMPUNG SUHUT', 'Toba')).toEqual(resolveAlias('ompung suhut', 'Toba'))
    expect(resolveAlias('OMPUNG SUHUT', 'Toba')).not.toBeNull()
  })

  it('6. guard Toba berisi tepat 3 key terurut', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual([
      'butet',
      'ompung suhut',
      'pariban',
    ])
  })

  it('7. non-regresi: butet child, pariban cousin, eda Karo sibling, lemirat Karo pernikahan', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
  })

  it('8. negatif pengunci Karo: suhut, bao, kula, kalin bernilai null', () => {
    for (const k of ['suhut', 'bao', 'kula', 'kalin']) {
      expect(resolveAlias(k, 'Karo'), `Karo.${k}`).toBeNull()
    }
  })

  it('9. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Toba', 'ompung suhut')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('\u2014')
    expect(note).not.toContain('--')
  })

  it('10. idempoten: dua panggilan sama, sama dengan map regional, key Toba tanpa duplikat', () => {
    const a = resolveAlias('ompung suhut', 'Toba')
    const b = resolveAlias('ompung suhut', 'Toba')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['ompung suhut'])
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(3)
  })

  it('11. kind grandparent anggota sah union: label id kakek nenek, en grandparent', async () => {
    const { KINSHIP_LABELS } = await import('./kinship-labels')
    expect(KINSHIP_LABELS['grandparent'].id).toBe('kakek nenek')
    expect(KINSHIP_LABELS['grandparent'].en).toBe('grandparent')
  })

  it('12. guard region map tetap tepat dua region: Karo dan Toba', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Toba'])
  })
})
