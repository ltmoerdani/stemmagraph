import { describe, expect, it } from 'vitest'
import { kinshipPhrase } from './kinship-phrase'
import type { KinshipKind, RelationshipResult } from './kinship-calc'

function res(kind: KinshipKind, depth?: number): RelationshipResult {
  return depth === undefined ? { kind } : { kind, depth }
}

describe('kinshipPhrase', () => {
  it('self dalam bahasa Indonesia', () => {
    expect(kinshipPhrase(res('self', 0), 'id')).toBe('Anda sendiri')
  })

  it('self dalam bahasa Inggris', () => {
    expect(kinshipPhrase(res('self', 0), 'en')).toBe('yourself')
  })

  it('partner depth 1 memakai pasangan netral suami atau istri', () => {
    expect(kinshipPhrase(res('partner', 1), 'id')).toBe('suami atau istri')
  })

  it('partner depth 1 versi Inggris', () => {
    expect(kinshipPhrase(res('partner', 1), 'en')).toBe('husband or wife')
  })

  it('parent depth 1 memakai ayah atau ibu', () => {
    expect(kinshipPhrase(res('parent', 1), 'id')).toBe('ayah atau ibu')
  })

  it('child depth 1 versi Inggris memakai son or daughter', () => {
    expect(kinshipPhrase(res('child', 1), 'en')).toBe('son or daughter')
  })

  it('sibling depth 1 memakai kakak atau adik', () => {
    expect(kinshipPhrase(res('sibling', 1), 'id')).toBe('kakak atau adik')
  })

  it('grandparent depth 2 memakai kakek atau nenek', () => {
    expect(kinshipPhrase(res('grandparent', 2), 'id')).toBe('kakek atau nenek')
  })

  it('grandchild depth 2 versi Inggris', () => {
    expect(kinshipPhrase(res('grandchild', 2), 'en')).toBe('grandson or granddaughter')
  })

  it('parent-sibling depth 2 menghasilkan frasa paman atau bibi', () => {
    expect(kinshipPhrase(res('parent-sibling', 2), 'id')).toBe(
      'paman atau bibi (saudara ayah atau ibu)',
    )
  })

  it('parent-sibling depth 2 versi Inggris uncle or aunt', () => {
    expect(kinshipPhrase(res('parent-sibling', 2), 'en')).toBe(
      "uncle or aunt (parent's sibling)",
    )
  })

  it('sibling-child depth 2 menghasilkan keponakan netral', () => {
    expect(kinshipPhrase(res('sibling-child', 2), 'id')).toBe('keponakan (anak saudara)')
  })

  it('cousin depth 2 konsisten di dua bahasa', () => {
    expect(kinshipPhrase(res('cousin', 2), 'id')).toBe('sepupu')
    expect(kinshipPhrase(res('cousin', 2), 'en')).toBe('cousin')
  })

  it('ancestor depth 3 menghasilkan buyut', () => {
    expect(kinshipPhrase(res('ancestor', 3), 'id')).toBe('buyut')
  })

  it('ancestor depth 4 menghasilkan canggah', () => {
    expect(kinshipPhrase(res('ancestor', 4), 'id')).toBe('canggah')
  })

  it('ancestor depth 5 versi Inggris memakai rantai great-', () => {
    expect(kinshipPhrase(res('ancestor', 5), 'en')).toBe('great-great-great-grandparent')
  })

  it('descendant depth 3 menghasilkan cicit', () => {
    expect(kinshipPhrase(res('descendant', 3), 'id')).toBe('cicit')
  })

  it('descendant depth 2 versi Inggris', () => {
    expect(kinshipPhrase(res('descendant', 2), 'en')).toBe('grandson or granddaughter')
  })

  it('unrelated menghasilkan frasa tanpa hubungan di dua bahasa', () => {
    expect(kinshipPhrase(res('unrelated'), 'id')).toBe('tidak ada hubungan kekerabatan')
    expect(kinshipPhrase(res('unrelated'), 'en')).toBe('no known relationship')
  })

  it('kind di luar kosakata kembali fallback tanpa throw', () => {
    const asing = { kind: '_unknown' } as unknown as RelationshipResult
    expect(kinshipPhrase(asing, 'id')).toBe('hubungan tidak dikenal')
    expect(kinshipPhrase(asing, 'en')).toBe('unknown relationship')
  })

  it('determinisme: dua kali pemanggilan hasil identik', () => {
    const a = kinshipPhrase(res('parent-sibling', 2), 'id')
    const b = kinshipPhrase(res('parent-sibling', 2), 'id')
    const c = kinshipPhrase(res('ancestor', 3), 'en')
    const d = kinshipPhrase(res('ancestor', 3), 'en')
    expect(a).toBe(b)
    expect(c).toBe(d)
  })
})
