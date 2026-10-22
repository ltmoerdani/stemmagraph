import { describe, expect, it } from 'vitest'
import {
  computeAverageFamilySizeByCentury,
  type FamilyCenturyRecord,
} from './average-family-size-by-century'

function rec(
  familyId: string,
  marriageDate: string | null,
  childIds: string[],
): FamilyCenturyRecord {
  return { familyId, marriageDate, childIds }
}

describe('computeAverageFamilySizeByCentury', () => {
  it('distribusi dasar multi abad urut ASC, average benar', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '1853-04-10', ['c1', 'c2', 'c3']),
      rec('f2', '1861-09-02', ['c4', 'c5', 'c6', 'c7', 'c8']),
      rec('f3', '1927-01-15', ['c9']),
    ])
    expect(result.centuries.map((c) => c.century)).toEqual(['1800', '1900'])
    expect(result.centuries[0]).toEqual({
      century: '1800',
      families: 2,
      totalChildren: 8,
      average: 4,
    })
    expect(result.centuries[1]).toEqual({
      century: '1900',
      families: 1,
      totalChildren: 1,
      average: 1,
    })
    expect(result.totalFamilies).toBe(3)
    expect(result.totalChildren).toBe(9)
    expect(result.undated).toBe(0)
  })

  it('urutan input diacak output identik (determinisme)', () => {
    const input = [
      rec('f1', '1751-01-01', ['c1']),
      rec('f2', '1999-12-31', ['c2', 'c3']),
      rec('f3', '1820-05-05', []),
      rec('f4', '2001-06-15', ['c4', 'c5', 'c6', 'c7']),
    ]
    const a = computeAverageFamilySizeByCentury(input)
    const b = computeAverageFamilySizeByCentury([...input].reverse())
    expect(a).toEqual(b)
  })

  it('abad tunggal', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '2001-02-02', ['c1', 'c2']),
      rec('f2', '2003-04-04', ['c3', 'c4', 'c5']),
    ])
    expect(result.centuries).toHaveLength(1)
    expect(result.centuries[0]).toEqual({
      century: '2000',
      families: 2,
      totalChildren: 5,
      average: 2.5,
    })
    expect(result.totalFamilies).toBe(2)
    expect(result.totalChildren).toBe(5)
    expect(result.undated).toBe(0)
  })

  it('input kosong menghasilkan struktur nol', () => {
    const result = computeAverageFamilySizeByCentury([])
    expect(result.centuries).toEqual([])
    expect(result.totalFamilies).toBe(0)
    expect(result.totalChildren).toBe(0)
    expect(result.undated).toBe(0)
  })

  it('semua marriageDate null hanya menghasilkan undated', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', null, ['c1']),
      rec('f2', null, ['c2', 'c3']),
    ])
    expect(result.centuries).toEqual([])
    expect(result.totalFamilies).toBe(0)
    expect(result.totalChildren).toBe(0)
    expect(result.undated).toBe(2)
  })

  it('campuran dated dan undated, undated keluar denominator', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '1950-03-03', ['c1', 'c2']),
      rec('f2', null, ['c3', 'c4', 'c5']),
      rec('f3', '1955-07-07', ['c6']),
    ])
    expect(result.centuries).toHaveLength(1)
    expect(result.centuries[0].families).toBe(2)
    expect(result.centuries[0].totalChildren).toBe(3)
    expect(result.centuries[0].average).toBe(1.5)
    expect(result.totalFamilies).toBe(2)
    expect(result.totalChildren).toBe(3)
    expect(result.undated).toBe(1)
  })

  it('childless tetap masuk denominator sehingga average turun', () => {
    const withChildren = computeAverageFamilySizeByCentury([
      rec('f1', '1940-01-01', ['c1', 'c2', 'c3', 'c4']),
    ])
    expect(withChildren.centuries[0].average).toBe(4)
    const withChildless = computeAverageFamilySizeByCentury([
      rec('f1', '1940-01-01', ['c1', 'c2', 'c3', 'c4']),
      rec('f2', '1945-02-02', []),
    ])
    expect(withChildless.centuries[0].families).toBe(2)
    expect(withChildless.centuries[0].totalChildren).toBe(4)
    expect(withChildless.centuries[0].average).toBe(2)
  })

  it('familyId duplikat tetap dihitung dua kali tanpa dedupe', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '1910-01-01', ['c1']),
      rec('f1', '1912-02-02', ['c2', 'c3']),
    ])
    expect(result.centuries).toHaveLength(1)
    expect(result.centuries[0].families).toBe(2)
    expect(result.centuries[0].totalChildren).toBe(3)
    expect(result.centuries[0].average).toBe(1.5)
    expect(result.totalFamilies).toBe(2)
  })

  it('pembulatan average dua desimal pola v370', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '1930-01-01', ['c1']),
      rec('f2', '1931-01-01', ['c2']),
      rec('f3', '1932-01-01', ['c3', 'c4']),
    ])
    expect(result.centuries[0].totalChildren).toBe(4)
    expect(result.centuries[0].families).toBe(3)
    expect(result.centuries[0].average).toBe(1.33)
  })

  it('boundary abad: 1900 dan 1999 masuk 1900, 2000 pindah 2000', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '1900-01-01', ['c1']),
      rec('f2', '1999-12-31', ['c2']),
      rec('f3', '2000-01-01', ['c3']),
    ])
    expect(result.centuries.map((c) => c.century)).toEqual(['1900', '2000'])
    expect(result.centuries[0].families).toBe(2)
    expect(result.centuries[1].families).toBe(1)
  })

  it('tahun batas 4 digit: 0001 abad 0, 9999 abad 9900', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '0001-01-01', ['c1']),
      rec('f2', '9999-12-31', ['c2']),
    ])
    expect(result.centuries.map((c) => c.century)).toEqual(['0', '9900'])
    expect(result.centuries[0].families).toBe(1)
    expect(result.centuries[1].families).toBe(1)
  })

  it('29 Feb tahun kabisat valid', () => {
    const result = computeAverageFamilySizeByCentury([
      rec('f1', '2024-02-29', ['c1']),
    ])
    expect(result.centuries[0].century).toBe('2000')
    expect(result.centuries[0].families).toBe(1)
  })

  it('throw records bukan array', () => {
    expect(() =>
      computeAverageFamilySizeByCentury('bukan array'),
    ).toThrowError(/records harus array/)
  })

  it('throw entri bukan objek', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '1900-01-01', []), 42]),
    ).toThrowError(/entri index 1 bukan objek/)
  })

  it('throw familyId bukan string dan string kosong', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([
        { familyId: 7, marriageDate: '1900-01-01', childIds: [] },
      ]),
    ).toThrowError(/familyId harus string/)
    expect(() =>
      computeAverageFamilySizeByCentury([rec('', '1900-01-01', [])]),
    ).toThrowError(/familyId tidak boleh string kosong/)
  })

  it('throw marriageDate tipe salah dan format salah', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([
        { familyId: 'f1', marriageDate: 19000101, childIds: [] },
      ]),
    ).toThrowError(/marriageDate harus string atau null/)
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '01-01-1900', [])]),
    ).toThrowError(/format bukan YYYY-MM-DD/)
  })

  it('throw bulan 00 dan bulan 13', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '1900-00-10', [])]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '1900-13-10', [])]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
  })

  it('throw 31 Feb dan 29 Feb non-kabisat', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '1900-02-31', [])]),
    ).toThrowError(/bukan tanggal kalender valid/)
    expect(() =>
      computeAverageFamilySizeByCentury([rec('f1', '1900-02-29', [])]),
    ).toThrowError(/bukan tanggal kalender valid/)
  })

  it('throw childIds bukan array', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([
        { familyId: 'f1', marriageDate: '1900-01-01', childIds: 'c1' },
      ]),
    ).toThrowError(/childIds harus array/)
  })

  it('throw elemen childIds bukan string', () => {
    expect(() =>
      computeAverageFamilySizeByCentury([
        { familyId: 'f1', marriageDate: '1900-01-01', childIds: ['c1', 99] },
      ]),
    ).toThrowError(/childIds posisi 1 harus string/)
  })
})
