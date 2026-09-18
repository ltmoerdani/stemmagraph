import { describe, it, expect } from 'vitest'
import { Gender, DEFAULT_GENDER, normalizeGender, toGedcomSex } from './gender'

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
