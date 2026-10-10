import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test trio in-law baku: besan, menantu, mertua (v253-vi, test-only).
 * Sumber entri: KBBI VI kbbi.kemendikdasmen.go.id plus Wiktionary ID oldid.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kontrak.
 */
describe('kinship-aliases in-law baku (v253-vi)', () => {
  it('1. entri besan live: kind property, tanpa region', () => {
    const e = KINSHIP_ALIASES['besan']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.region).toBeUndefined()
  })

  it('2. entri menantu live: kind property, tanpa region', () => {
    const e = KINSHIP_ALIASES['menantu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.region).toBeUndefined()
  })

  it('3. entri mertua live: kind property, tanpa region', () => {
    const e = KINSHIP_ALIASES['mertua']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.region).toBeUndefined()
  })

  it('4. resolveAlias ketiganya non-null', () => {
    expect(resolveAlias('besan')).not.toBeNull()
    expect(resolveAlias('menantu')).not.toBeNull()
    expect(resolveAlias('mertua')).not.toBeNull()
  })

  it('5. guard homonim: besan2 masakan Betawi nihil sebagai key', () => {
    expect(aliasKinds()).not.toContain('besan2')
    expect(resolveAlias('besan2')).toBeNull()
  })

  it('6. guard bentuk tidak baku: bisan nihil sebagai key', () => {
    expect(aliasKinds()).not.toContain('bisan')
    expect(resolveAlias('bisan')).toBeNull()
  })

  it('7. guard bentuk tidak baku: minantu tetap null', () => {
    expect(resolveAlias('minantu')).toBeNull()
  })

  it('8. non-regresi tetangga: sepupu cousin, keponakan sibling-child', () => {
    expect(resolveAlias('sepupu')?.kind).toBe('cousin')
    expect(resolveAlias('keponakan')?.kind).toBe('sibling-child')
  })

  it('9. guard jumlah key PERSIS 81 (78 baseline v253-v parumaen plus 3 trio in-law)', () => {
    expect(aliasKinds().length).toBe(81)
  })

  it('10. nihil key duplikat di map utama', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('11. note trio memuat penanda sumber KBBI VI dan Wiktionary ID', () => {
    for (const k of ['besan', 'menantu', 'mertua']) {
      const note = KINSHIP_ALIASES[k].note ?? ''
      expect(note).toContain('kbbi.kemendikdasmen.go.id')
      expect(note).toContain('Wiktionary ID oldid')
    }
  })

  it('12. komposit nihil: besanan null, mertuakan null', () => {
    expect(resolveAlias('besanan')).toBeNull()
    expect(resolveAlias('mertuakan')).toBeNull()
  })
})
