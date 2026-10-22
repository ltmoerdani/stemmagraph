/**
 * Test dedikasi v355: computeAgeAtDivorceDistributions
 * (src/lib/stats/age-at-divorce.ts). Test-only, pure: nihil DB,
 * nihil jaringan, nihil jam sistem sehingga deterministik penuh.
 * Kasus mengikuti kontrak v355: happy path dua seri, overflow 80+,
 * co-trim awal/akhir/dua sisi, interior nol dipertahankan, seri satu
 * sisi nol, parser throw ber-prefiks, tanggal invalid per record,
 * kabisat, usia negatif, sex lain, input kosong, determinisme urutan,
 * urutan key naik, counter eksklusi.
 */

import { describe, expect, it } from 'vitest'
import {
  AGE_AT_DIVORCE_BUCKET_KEYS,
  computeAgeAtDivorceDistributions,
  type AgeAtDivorceEntry,
} from './age-at-divorce'

function m(birthDate: string, divorceDate: string): AgeAtDivorceEntry {
  return { sex: 'M', birthDate, divorceDate }
}

function f(birthDate: string, divorceDate: string): AgeAtDivorceEntry {
  return { sex: 'F', birthDate, divorceDate }
}

describe('computeAgeAtDivorceDistributions', () => {
  it('kasus 1: happy path kedua seri nilai benar dan key identik', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1960-05-10', '1990-06-01'), // usia 30 band 30-34
      m('1970-03-15', '2000-03-14'), // usia 29 band 25-29 (anniversary belum lewat)
      f('1980-07-20', '2010-07-20'), // usia 30 band 30-34
      f('1950-01-01', '2015-08-09'), // usia 65 band 65-69
    ])
    expect(Object.keys(result.husband)).toEqual(Object.keys(result.wife))
    expect(result.husband['25-29']).toBe(1)
    expect(result.husband['30-34']).toBe(1)
    expect(result.wife['30-34']).toBe(1)
    expect(result.wife['65-69']).toBe(1)
    expect(result.excludedInvalid).toBe(0)
    expect(result.excludedNegative).toBe(0)
    expect(result.excludedOtherSex).toBe(0)
  })

  it('kasus 2: usia 93 dan 80 masuk band overflow 80+', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1930-02-01', '2023-03-01'), // usia 93
      f('1943-06-30', '2023-06-30'), // usia 80 (anniversary tepat lewat)
      m('1944-01-15', '2023-01-14'), // usia 78 band 75-79 (bukan 80+)
    ])
    expect(result.husband['80+']).toBe(1)
    expect(result.wife['80+']).toBe(1)
    expect(result.husband['75-79']).toBe(1)
    expect(Object.keys(result.wife)).toContain('75-79')
  })

  it('kasus 3: co-trim awal membuang bucket nol depan kedua seri', () => {
    const result = computeAgeAtDivorceDistributions([
      m('2000-01-01', '2021-06-01'), // usia 21 band 20-24
      f('1935-04-04', '2020-05-05'), // usia 85 band 80+
    ])
    expect(Object.keys(result.husband)[0]).toBe('20-24')
    expect(Object.keys(result.husband).at(-1)).toBe('80+')
    expect(Object.keys(result.wife)).toEqual(Object.keys(result.husband))
    expect(Object.keys(result.husband)).not.toContain('15-19')
  })

  it('kasus 4: co-trim akhir membuang bucket nol belakang kedua seri', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1997-06-01', '2000-07-01'), // usia 3 band 0-4
      f('1980-11-11', '2008-10-10'), // usia 27 band 25-29
    ])
    expect(Object.keys(result.husband)[0]).toBe('0-4')
    expect(Object.keys(result.husband).at(-1)).toBe('25-29')
    expect(Object.keys(result.wife)).toEqual(Object.keys(result.husband))
    expect(Object.keys(result.husband)).not.toContain('30-34')
  })

  it('kasus 5: co-trim dua sisi menyisakan rentang di tengah', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1990-02-02', '2015-03-03'), // usia 25 band 25-29
      f('1960-08-08', '2015-09-09'), // usia 55 band 55-59
    ])
    expect(Object.keys(result.husband)).toEqual([
      '25-29',
      '30-34',
      '35-39',
      '40-44',
      '45-49',
      '50-54',
      '55-59',
    ])
    expect(Object.keys(result.wife)).toEqual(Object.keys(result.husband))
  })

  it('kasus 6: bucket nol interior dipertahankan', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1985-01-01', '2010-01-01'), // usia 25 band 25-29
      m('1955-01-01', '2010-01-01'), // usia 55 band 55-59
    ])
    expect(Object.keys(result.husband)).toContain('40-44')
    expect(result.husband['40-44']).toBe(0)
    expect(result.wife['40-44']).toBe(0)
  })

  it('kasus 7: bucket dengan satu seri nol tetap dipertahankan bila pasangan berisi', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1999-04-04', '2020-05-05'), // usia 21 band 20-24
      f('1990-02-02', '2020-03-03'), // usia 30 band 30-34
      f('1988-01-01', '2020-02-01'), // usia 32 band 30-34
    ])
    expect(result.husband['30-34']).toBe(0)
    expect(result.wife['30-34']).toBe(2)
    expect(Object.keys(result.husband)).toContain('30-34')
    expect(result.husband['20-24']).toBe(1)
    expect(result.wife['20-24']).toBe(0)
    expect(Object.keys(result.husband)).toContain('20-24')
  })

  it('kasus 8: entry bukan objek melempar Error ber-prefiks age-at-divorce ber-index', () => {
    const bad = [null, 42, 'x', [m('1990-01-01', '2010-01-01')]]
    for (const [i, entry] of bad.entries()) {
      expect(() =>
        computeAgeAtDivorceDistributions([entry as unknown as AgeAtDivorceEntry]),
      ).toThrowError(/age-at-divorce: entries\[0\]/)
      expect(i).toBeGreaterThanOrEqual(0)
    }
  })

  it('kasus 9: field bertipe salah (sex, birthDate, divorceDate) melempar ber-prefiks', () => {
    expect(() =>
      computeAgeAtDivorceDistributions([
        { sex: 7, birthDate: '1990-01-01', divorceDate: '2010-01-01' } as unknown as AgeAtDivorceEntry,
      ]),
    ).toThrowError(/age-at-divorce: entries\[0\]\.sex/)
    expect(() =>
      computeAgeAtDivorceDistributions([
        { sex: 'M', birthDate: 1990, divorceDate: '2010-01-01' } as unknown as AgeAtDivorceEntry,
      ]),
    ).toThrowError(/age-at-divorce: entries\[0\]\.birthDate/)
    expect(() =>
      computeAgeAtDivorceDistributions([
        { sex: 'F', birthDate: '1990-01-01', divorceDate: true } as unknown as AgeAtDivorceEntry,
      ]),
    ).toThrowError(/age-at-divorce: entries\[0\]\.divorceDate/)
  })

  it('kasus 10: tanggal invalid dibuang per record ke excludedInvalid tanpa throw', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1990-1-1', '2010-01-01'), // format tidak EXACT
      m('1990-13-01', '2010-01-01'), // bulan 13
      f('1990-01-01', '2010-00-15'), // bulan 0
      m('1990-01-32', '2010-01-01'), // hari 32
      f(null, '2010-01-01'), // birth null
      m('1990-01-01', null), // divorce null
      m('1990-01-01', '2010-02-30'), // hari 30 di Februari
    ])
    expect(result.excludedInvalid).toBe(7)
    expect(result.husband).toEqual({})
    expect(result.wife).toEqual({})
  })

  it('kasus 11: kabisat valid dipakai dan anniversary-aware pada 29 Februari', () => {
    const result = computeAgeAtDivorceDistributions([
      m('2000-02-29', '2025-02-28'), // usia 24 band 20-24 (anniversary 29 belum lewat)
      m('2000-02-29', '2025-03-01'), // usia 25 band 25-29
      f('1996-02-29', '2020-02-29'), // usia 24 tepat (anniversary justru hari itu)
    ])
    expect(result.excludedInvalid).toBe(0)
    expect(result.husband['20-24']).toBe(1)
    expect(result.husband['25-29']).toBe(1)
    expect(result.wife['20-24']).toBe(1)
  })

  it('kasus 12: 29 Februari tahun non-kabisat ditolak (1900 dan 2021)', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1900-02-29', '1925-03-01'),
      f('2021-02-29', '2045-03-01'),
    ])
    expect(result.excludedInvalid).toBe(2)
    expect(result.husband).toEqual({})
    expect(result.wife).toEqual({})
  })

  it('kasus 13: divorceDate sebelum birthDate masuk excludedNegative', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1995-06-15', '1995-06-14'), // sehari sebelum lahir
      f('1990-01-01', '1980-01-01'),
      m('1990-05-05', '1990-05-05'), // hari sama: usia 0 band 0-4
    ])
    expect(result.excludedNegative).toBe(2)
    expect(result.husband['0-4']).toBe(1)
  })

  it('kasus 14: sex selain M dan F masuk excludedOtherSex', () => {
    const result = computeAgeAtDivorceDistributions([
      { sex: 'X', birthDate: '1990-01-01', divorceDate: '2010-01-01' },
      { sex: '', birthDate: '1990-01-01', divorceDate: '2010-01-01' },
      { sex: 'm', birthDate: '1990-01-01', divorceDate: '2010-01-01' },
      { sex: 'U', birthDate: '1990-01-01', divorceDate: '2010-01-01' },
    ])
    expect(result.excludedOtherSex).toBe(4)
    expect(result.husband).toEqual({})
    expect(result.wife).toEqual({})
  })

  it('kasus 15: input kosong menghasilkan kedua seri kosong tanpa throw', () => {
    const result = computeAgeAtDivorceDistributions([])
    expect(result.husband).toEqual({})
    expect(result.wife).toEqual({})
    expect(result.excludedInvalid).toBe(0)
    expect(result.excludedNegative).toBe(0)
    expect(result.excludedOtherSex).toBe(0)
  })

  it('kasus 16: determinisme, urutan input dibalik hasil tetap identik', () => {
    const entries = [
      m('1960-05-10', '1990-06-01'),
      f('1980-07-20', '2010-07-20'),
      m('1970-03-15', '2000-03-14'),
      f('1950-01-01', '2015-08-09'),
      { sex: 'X', birthDate: '1990-01-01', divorceDate: '2010-01-01' },
      m('bad', '2010-01-01'),
      f('1995-06-15', '1995-06-14'),
    ]
    const a = computeAgeAtDivorceDistributions(entries)
    const b = computeAgeAtDivorceDistributions([...entries].reverse())
    expect(a).toEqual(b)
    expect(Object.keys(a.husband)).toEqual(Object.keys(b.husband))
  })

  it('kasus 17: urutan key kedua seri selalu naik sesuai definisi bucket', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1955-02-02', '2015-03-03'), // usia 60 band 60-64
      f('1995-09-09', '2015-10-10'), // usia 20 band 20-24
    ])
    const husbandKeys = Object.keys(result.husband)
    const wifeKeys = Object.keys(result.wife)
    const expected = AGE_AT_DIVORCE_BUCKET_KEYS.filter(
      (k) => husbandKeys.includes(k) || wifeKeys.includes(k),
    )
    // Rentang tersisa 20-24 sampai 60-64 semuanya hadir karena interior.
    expect(husbandKeys).toEqual(expected)
    expect(wifeKeys).toEqual(expected)
    for (let i = 1; i < husbandKeys.length; i += 1) {
      expect(AGE_AT_DIVORCE_BUCKET_KEYS.indexOf(husbandKeys[i] as never)).toBeGreaterThan(
        AGE_AT_DIVORCE_BUCKET_KEYS.indexOf(husbandKeys[i - 1] as never),
      )
    }
  })

  it('kasus 18: counter eksklusi terpisah dan total record konsisten', () => {
    const result = computeAgeAtDivorceDistributions([
      m('1990-1-1', '2010-01-01'), // invalid
      m('1990-13-01', '2010-01-01'), // invalid
      f('1995-06-15', '1995-06-14'), // negative
      { sex: 'U', birthDate: '1990-01-01', divorceDate: '2010-01-01' }, // other
      m('1960-05-10', '1990-06-01'), // valid band 30-34
      f('1960-05-10', '1990-06-01'), // valid band 30-34
    ])
    expect(result.excludedInvalid).toBe(2)
    expect(result.excludedNegative).toBe(1)
    expect(result.excludedOtherSex).toBe(1)
    const total = result.husband['30-34'] + result.wife['30-34']
    expect(total).toBe(2)
    expect(2 + 1 + 1 + total).toBe(6)
  })
})
