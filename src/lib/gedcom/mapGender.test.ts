// Unit test mapGender (S1F2-B): nilai kanonik, varian singkatan dan
// Indonesia, case/whitespace, serta jaminan tanpa memihak (kosong, null,
// undefined, tak dikenal selalu 'unknown', tidak pernah male/female).

import { describe, expect, it } from 'vitest'
import { mapGender } from './mapGender'

describe('mapGender - nilai kanonik', () => {
  it('terima male dan female apa adanya', () => {
    expect(mapGender('male')).toBe('male')
    expect(mapGender('female')).toBe('female')
  })

  it('case-insensitive: MALE, Female, FeMaLe', () => {
    expect(mapGender('MALE')).toBe('male')
    expect(mapGender('Female')).toBe('female')
    expect(mapGender('FeMaLe')).toBe('female')
  })

  it('buang spasi tepi sebelum memetakan', () => {
    expect(mapGender('  male ')).toBe('male')
    expect(mapGender('\tfemale\n')).toBe('female')
  })
})

describe('mapGender - varian dan singkatan', () => {
  it('singkatan M dan F dalam kapitalisasi apa pun', () => {
    expect(mapGender('M')).toBe('male')
    expect(mapGender('m')).toBe('male')
    expect(mapGender('F')).toBe('female')
    expect(mapGender('f')).toBe('female')
  })

  it('varian Inggris man, boy, woman, girl', () => {
    expect(mapGender('man')).toBe('male')
    expect(mapGender('boy')).toBe('male')
    expect(mapGender('woman')).toBe('female')
    expect(mapGender('girl')).toBe('female')
  })

  it('varian Indonesia laki-laki, lelaki, pria, laki laki', () => {
    expect(mapGender('laki-laki')).toBe('male')
    expect(mapGender('Laki-Laki')).toBe('male')
    expect(mapGender('lelaki')).toBe('male')
    expect(mapGender('pria')).toBe('male')
    expect(mapGender('laki laki')).toBe('male')
  })

  it('varian Indonesia perempuan, wanita, cewek', () => {
    expect(mapGender('perempuan')).toBe('female')
    expect(mapGender('Wanita')).toBe('female')
    expect(mapGender('cewek')).toBe('female')
  })

  it('lipat spasi ganda internal: "laki   laki"', () => {
    expect(mapGender('laki   laki')).toBe('male')
  })
})

describe('mapGender - tanpa memihak', () => {
  it('nilai tak dikenal kembali unknown, tidak pernah fallback male/female', () => {
    expect(mapGender('helicopter')).toBe('unknown')
    expect(mapGender('X')).toBe('unknown')
    expect(mapGender('laki-lakix')).toBe('unknown')
  })

  it('string kosong dan whitespace saja kembali unknown', () => {
    expect(mapGender('')).toBe('unknown')
    expect(mapGender('   ')).toBe('unknown')
  })

  it('null dan undefined kembali unknown', () => {
    expect(mapGender(null)).toBe('unknown')
    expect(mapGender(undefined)).toBe('unknown')
  })
})
