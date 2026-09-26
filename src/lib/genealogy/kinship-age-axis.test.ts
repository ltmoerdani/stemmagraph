import { describe, expect, it } from 'vitest'
import {
  resolveAgeCompositePhrase,
  resolveSiblingAgeAxis,
} from './kinship-age-axis'

describe('resolveAgeCompositePhrase: enam sub-entri resmi halaman adik', () => {
  it('adik bungsu: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik bungsu')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('adik ipar: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik ipar')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('adik seayah: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik seayah')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('adik seibu: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik seibu')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('adik seibu seayah: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik seibu seayah')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })

  it('adik sepupu: resmi, younger', () => {
    expect(resolveAgeCompositePhrase('adik sepupu')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })
})

describe('resolveAgeCompositePhrase: kakak ipar dan frasa tak dikenali', () => {
  it('kakak ipar: komposisi produktif, dictionaryRecorded false (notes 404)', () => {
    expect(resolveAgeCompositePhrase('kakak ipar')).toEqual({
      base: 'kakak',
      axis: 'older',
      dictionaryRecorded: false,
    })
  })

  it('frasa tanpa pelengkap usia return null', () => {
    expect(resolveAgeCompositePhrase('adik')).toBeNull()
    expect(resolveAgeCompositePhrase('kakak')).toBeNull()
  })

  it('normalisasi input: trim, lowercase, rapat spasi', () => {
    expect(resolveAgeCompositePhrase('  ADIK   Seibu  ')).toEqual({
      base: 'adik',
      axis: 'younger',
      dictionaryRecorded: true,
    })
  })
})

describe('resolveSiblingAgeAxis', () => {
  it('A lahir lebih dulu: older', () => {
    expect(resolveSiblingAgeAxis('1990-01-01', '1995-06-15')).toBe('older')
  })

  it('A lahir lebih belakangan: younger', () => {
    expect(resolveSiblingAgeAxis('2000-03-10', '1995-06-15')).toBe('younger')
  })

  it('salah satu tanggal nihil: unknown', () => {
    expect(resolveSiblingAgeAxis(null, '1995-06-15')).toBe('unknown')
    expect(resolveSiblingAgeAxis('1990-01-01', undefined)).toBe('unknown')
  })

  it('tanggal identik: unknown', () => {
    expect(resolveSiblingAgeAxis('1995-06-15', '1995-06-15')).toBe('unknown')
  })

  it('tanggal invalid: unknown tanpa throw', () => {
    expect(resolveSiblingAgeAxis('bukan-tanggal', '1995-06-15')).toBe('unknown')
    expect(resolveSiblingAgeAxis(new Date('tidak valid'), '1995-06-15')).toBe(
      'unknown',
    )
  })

  it('input Date object didukung', () => {
    expect(
      resolveSiblingAgeAxis(new Date('1990-01-01'), new Date('1995-06-15')),
    ).toBe('older')
  })
})

describe('integrasi axis dan frasa', () => {
  it('frasa kakak ipar konsisten dengan axis dari tanggal lahir', () => {
    const res = resolveAgeCompositePhrase('kakak ipar')
    expect(res).not.toBeNull()
    const axis = resolveSiblingAgeAxis('1985-02-03', '1990-07-07')
    expect(res?.axis).toBe(axis)
  })

  it('frasa adik bungsu konsisten dengan axis younger', () => {
    const res = resolveAgeCompositePhrase('adik bungsu')
    expect(res).not.toBeNull()
    const axis = resolveSiblingAgeAxis('2001-12-31', '1998-04-01')
    expect(axis).toBe('younger')
    expect(res?.axis).toBe(axis)
  })
})
