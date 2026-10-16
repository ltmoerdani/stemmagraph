import { describe, it, expect } from 'vitest'
import { Gender, DEFAULT_GENDER, normalizeGender, toGedcomSex, resolveSexGed } from './gender'

describe('Gender default', () => {
  it('DEFAULT_GENDER adalah U (unknown)', () => {
    expect(DEFAULT_GENDER).toBe('U')
  })
})

describe('normalizeGender: mapping lengkap', () => {
  it('male dan m menjadi M', () => {
    expect(normalizeGender('male')).toBe('M')
    expect(normalizeGender('M')).toBe('M')
    expect(normalizeGender(' Male ')).toBe('M')
  })

  it('female dan f menjadi F', () => {
    expect(normalizeGender('female')).toBe('F')
    expect(normalizeGender('F')).toBe('F')
    expect(normalizeGender(' Female ')).toBe('F')
  })

  it('other, x, nonbinary, non-binary menjadi X', () => {
    expect(normalizeGender('other')).toBe('X')
    expect(normalizeGender('x')).toBe('X')
    expect(normalizeGender('nonbinary')).toBe('X')
    expect(normalizeGender('non-binary')).toBe('X')
  })

  it('null, undefined, kosong, dan teks asing jatuh ke default U', () => {
    expect(normalizeGender(null)).toBe('U')
    expect(normalizeGender(undefined)).toBe('U')
    expect(normalizeGender('')).toBe('U')
    expect(normalizeGender('tidak dikenal')).toBe('U')
  })
})

describe('toGedcomSex: enumset SEX GEDCOM 7', () => {
  it('identitas untuk empat nilai valid M, F, X, U', () => {
    const values: Gender[] = ['M', 'F', 'X', 'U']
    for (const value of values) {
      expect(toGedcomSex(value)).toBe(value)
    }
  })
})

describe('resolveSexGed: prefer verbatim, fallback gender (v262)', () => {
  it('sexGed U valid dipakai verbatim walau gender berkata lain', () => {
    expect(resolveSexGed('U', 'male')).toBe('U')
  })

  it('sexGed X valid dipakai verbatim', () => {
    expect(resolveSexGed('X', 'male')).toBe('X')
  })

  it('sexGed M dan F valid dipakai verbatim', () => {
    expect(resolveSexGed('M', 'female')).toBe('M')
    expect(resolveSexGed('F', 'male')).toBe('F')
  })

  it("sexGed 'zzz' asing gugur ke fallback gender", () => {
    expect(resolveSexGed('zzz', 'male')).toBe('M')
    expect(resolveSexGed('zzz', 'other')).toBe('X')
  })

  it('null dan undefined gugur ke fallback gender', () => {
    expect(resolveSexGed(null, 'other')).toBe('X')
    expect(resolveSexGed(undefined, 'female')).toBe('F')
  })

  it('fallback male menghasilkan M dan fallback nihil menghasilkan U', () => {
    expect(resolveSexGed(null, 'male')).toBe('M')
    expect(resolveSexGed(undefined, null)).toBe('U')
    expect(resolveSexGed('', undefined)).toBe('U')
  })

  it('case-sensitive: lowercase u bukan enumset, gugur ke fallback', () => {
    expect(resolveSexGed('u', 'male')).toBe('M')
    expect(resolveSexGed('m', 'other')).toBe('X')
  })
})
