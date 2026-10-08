import { describe, expect, it } from 'vitest'
import {
  resolveAlias,
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
} from './kinship-aliases'
import { regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases nondong Langkat (v252-ix, kind grandparent depth 1)', () => {
  it('1. positif: nondong Langkat resolve kind grandparent depth 1 region Langkat', () => {
    const r = resolveAlias('nondong', 'Langkat')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Langkat')
  })

  it('2. case-insensitive dan trim: NONDONG dan "  Nondong " sama dengan nondong', () => {
    expect(resolveAlias('NONDONG', 'Langkat')).toEqual(
      resolveAlias('nondong', 'Langkat'),
    )
    expect(resolveAlias('  Nondong ', 'Langkat')).toEqual(
      resolveAlias('nondong', 'Langkat'),
    )
  })

  it('3. kontrol negatif: tanpa region nihil alias (bukan alias global)', () => {
    expect(resolveAlias('nondong')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('nondong')
  })

  it('4. kontrol negatif: region lain nihil (Toba, Karo, Simalungun)', () => {
    expect(resolveAlias('nondong', 'Toba')).toBeNull()
    expect(resolveAlias('nondong', 'Karo')).toBeNull()
    expect(resolveAlias('nondong', 'Simalungun')).toBeNull()
  })

  it('5. guard homonim: kata langkat lain homograf tidak ikut terindeks (v252-ix: nondong, v252-x bump: plus bulang)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL['Langkat'] ?? {}).sort()
    expect(keys).toEqual(['bulang', 'nondong'])
  })

  it('6. guard daftar region: Karo, Langkat, Simalungun, Toba', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual([
      'Karo',
      'Langkat',
      'Simalungun',
      'Toba',
    ])
  })

  it('7. note memuat dual-anchor langkat dan kontrol negatif KBBI', () => {
    const note = regionalNote('Langkat', 'nondong')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('langkat')
    expect(note).toContain('KBBI nihil lema nondong')
    expect(note).toContain('grandparent')
  })

  it('8. non-regresi: key regional existing tetap resolve lintas blok', () => {
    expect(resolveAlias('anggi', 'Simalungun')?.kind).toBe('sibling')
    expect(resolveAlias('abang', 'Simalungun')?.kind).toBe('sibling')
    expect(regionalNote('Langkat', 'nondong').length).toBeGreaterThan(0)
  })

  it('9. struktur AliasEntry lengkap tanpa field liar', () => {
    const r = resolveAlias('nondong', 'Langkat')
    expect(Object.keys(r ?? {}).sort()).toEqual([
      'depth',
      'kind',
      'note',
      'region',
    ]
    )
  })

  it('10. nondong diikuti spasi ganda ternormalisasi tetap resolve', () => {
    expect(resolveAlias('  nondong  ', 'Langkat')).not.toBeNull()
  })
})
