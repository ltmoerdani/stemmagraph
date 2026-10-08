import { describe, expect, it } from 'vitest'
import {
  resolveAlias,
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
} from './kinship-aliases'
import { regionalNote } from './__tests__/alias-entry'
import { expandAliasQuery } from './search-filter'

describe('kinship-aliases bulang Karo-Langkat (v252-x, kind grandparent depth 1)', () => {
  it('1. positif: bulang (blok Langkat) resolve kind grandparent depth 1, region Karo-Langkat', () => {
    const r = resolveAlias('bulang', 'Langkat')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo-Langkat')
  })

  it('2. guard homonim: makna headgear atau taji KBBI bulang1 tidak dipetakan (blok Langkat tepat dua key bulang dan nondong)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL['Langkat'] ?? {}).sort()
    expect(keys).toEqual(['bulang', 'nondong'])
    expect(keys).not.toContain('bulang2')
    expect(resolveAlias('bulang', 'Karo')).toBeNull()
    expect(resolveAlias('bulang', 'Toba')).toBeNull()
    expect(resolveAlias('bulang', 'Simalungun')).toBeNull()
  })

  it('3. kontrol negatif: tanpa region nihil alias (bukan alias global)', () => {
    expect(resolveAlias('bulang')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('bulang')
  })

  it('4. non-regresi komposit live: nini bulang tetap live kind grandparent region Karo', () => {
    const r = resolveAlias('nini bulang', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toBe('Karo')
  })

  it('5. non-regresi nondong pasca v252-ix: tetap grandparent depth 1 region Langkat', () => {
    const r = resolveAlias('nondong', 'Langkat')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(1)
  })

  it('6. expandAliasQuery mengenali key baru', () => {
    const q = expandAliasQuery('bulang')
    expect(Array.isArray(q)).toBe(true)
    expect(q.length).toBeGreaterThanOrEqual(1)
    expect(q[0]).toBe('bulang')
  })

  it('7. jumlah key blok Langkat naik persis 1 dari v252-ix (nondong plus bulang)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL['Langkat'] ?? {})
    expect(keys).toHaveLength(2)
  })

  it('8. note memuat dua jangkar resmi dan guard homonim KBBI', () => {
    const note = regionalNote('Langkat', 'bulang')
    expect(note).toContain('Wikipedia ID Orat Tutur oldid 27551096')
    expect(note).toContain('Woollams 1996 baris 319')
    expect(note).toContain('bulang1')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('9. case-insensitive dan trim', () => {
    expect(resolveAlias('BULANG', 'Langkat')).toEqual(
      resolveAlias('bulang', 'Langkat'),
    )
    expect(resolveAlias('  Bulang  ', 'Langkat')).not.toBeNull()
  })

  it('10. guard daftar region tetap empat blok: Karo, Langkat, Simalungun, Toba', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual([
      'Karo',
      'Langkat',
      'Simalungun',
      'Toba',
    ])
  })
})
