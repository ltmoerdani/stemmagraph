import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key semenda (v253xxvi gelombang delapan, test-only).
 * Sumber entri: KBBI VI resmi kemendikdasmen se.men.da dua makna keduanya
 * affine (pertalian keluarga karena perkawinan dengan anggota suatu kaum,
 * kerabat karena hubungan perkawinan) plus Wiktionary ID oldid 1126638
 * (templat rfv dicatat jujur di note entri). Entri live ada di
 * kinship-aliases.ts; test ini mengunci kontrak gugus affine baku dan
 * guard anti penempatan salah kind.
 */
describe('kinship-aliases semenda (v253xxvi)', () => {
  it('1. entri semenda live: kind property, tanpa region', () => {
    const e = KINSHIP_ALIASES['semenda']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.region).toBeUndefined()
  })

  it('2. resolveAlias semenda non-null dan kind property', () => {
    const r = resolveAlias('semenda')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('3. varian kapitalisasi resolve identik', () => {
    expect(resolveAlias('Semenda')?.kind).toBe('property')
    expect(resolveAlias('SEMENDA')?.kind).toBe('property')
  })

  it('4. gugus affine baku konsisten: property eksak besan ipar menantu mertua semenda', () => {
    const props = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'property')
      .sort()
    expect(props).toEqual(['besan', 'ipar', 'mantu', 'menantu', 'mertua', 'semenda'])
  })

  it('5. bentuk tidak baku semanda dan sumanda BUKAN key', () => {
    expect(KINSHIP_ALIASES['semanda']).toBeUndefined()
    expect(KINSHIP_ALIASES['sumanda']).toBeUndefined()
    expect(resolveAlias('semanda')).toBeNull()
    expect(resolveAlias('sumanda')).toBeNull()
  })

  it('6. semenda tidak bocor ke kind lain', () => {
    expect(aliasKinds().filter((k) => k === 'semenda')).toHaveLength(1)
    const ps = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
    expect(ps).not.toContain('semenda')
    const sc = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'sibling-child')
    expect(sc).not.toContain('semenda')
  })

  it('7. note sumber lengkap: KBBI VI dua makna plus Wiktionary oldid 1126638 rfv jujur', () => {
    const note = KINSHIP_ALIASES['semenda'].note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('pertalian keluarga karena perkawinan')
    expect(note).toContain('kerabat karena hubungan perkawinan')
    expect(note).toContain('semanda')
    expect(note).toContain('1126638')
    expect(note).toContain('rfv')
  })

  it('8. guard jumlah key PERSIS 113 pasca v253xxvi gelombang delapan (112 jadi 113: semenda)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(120)
    expect(aliasKinds().length).toBe(120)
  })

  it('9. non-regresi gugus affine: besan menantu mertua ipar tetap live kind property', () => {
    for (const k of ['besan', 'menantu', 'mertua', 'ipar']) {
      expect(KINSHIP_ALIASES[k]?.kind).toBe('property')
      expect(resolveAlias(k)).not.toBeNull()
    }
  })
})
