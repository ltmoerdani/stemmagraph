import { describe, expect, it } from 'vitest'
import {
  computeDeathsByCentury,
  type DeathRecord,
} from './deaths-by-century'

function rec(personId: string, deathDate: string | null): DeathRecord {
  return { personId, deathDate }
}

describe('computeDeathsByCentury', () => {
  it('input kosong menghasilkan output nol tanpa throw', () => {
    const result = computeDeathsByCentury([])
    expect(result.centuries).toEqual([])
    expect(result.total).toBe(0)
    expect(result.undated).toBe(0)
  })

  it('kasus dasar satu abad', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1540-05-10'),
      rec('P2', '1566-01-02'),
      rec('P3', '1599-12-31'),
    ])
    expect(result.centuries).toEqual([{ century: '1500', count: 3 }])
    expect(result.total).toBe(3)
    expect(result.undated).toBe(0)
  })

  it('multi abad urut ASC numerik dari input acak', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1850-06-15'),
      rec('P2', '1720-03-01'),
      rec('P3', '1490-07-20'),
      rec('P4', '1999-11-11'),
      rec('P5', '1744-04-04'),
    ])
    expect(result.centuries).toEqual([
      { century: '1400', count: 1 },
      { century: '1700', count: 2 },
      { century: '1800', count: 1 },
      { century: '1900', count: 1 },
    ])
    expect(result.total).toBe(5)
  })

  it('semua deathDate null menghasilkan undated penuh tanpa centuries', () => {
    const result = computeDeathsByCentury([
      rec('P1', null),
      rec('P2', null),
      rec('P3', null),
    ])
    expect(result.centuries).toEqual([])
    expect(result.total).toBe(0)
    expect(result.undated).toBe(3)
  })

  it('mixed dated dan undated', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1820-02-20'),
      rec('P2', null),
      rec('P3', '1899-06-30'),
      rec('P4', null),
      rec('P5', '1801-01-01'),
    ])
    expect(result.centuries).toEqual([
      { century: '1800', count: 3 },
    ])
    expect(result.total).toBe(3)
    expect(result.undated).toBe(2)
  })

  it('boundary 1699 jatuh abad 1600 dan 1700 jatuh abad 1700', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1699-12-31'),
      rec('P2', '1700-01-01'),
    ])
    expect(result.centuries).toEqual([
      { century: '1600', count: 1 },
      { century: '1700', count: 1 },
    ])
  })

  it('boundary 1999 jatuh abad 1900 dan 2000 jatuh abad 2000', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1999-12-31'),
      rec('P2', '2000-01-01'),
    ])
    expect(result.centuries).toEqual([
      { century: '1900', count: 1 },
      { century: '2000', count: 1 },
    ])
  })

  it('duplikat personId tidak didedupe: semua entri dihitung', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1750-05-05'),
      rec('P1', '1760-06-06'),
      rec('P1', '1770-07-07'),
    ])
    expect(result.centuries).toEqual([{ century: '1700', count: 3 }])
    expect(result.total).toBe(3)
  })

  it('total sama dengan jumlah count semua abad', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1500-01-01'),
      rec('P2', '1600-02-02'),
      rec('P3', '1601-03-03'),
      rec('P4', '1700-04-04'),
      rec('P5', null),
    ])
    const sum = result.centuries.reduce((acc, row) => acc + row.count, 0)
    expect(result.total).toBe(sum)
    expect(result.total).toBe(4)
  })

  it('kohor nihil di tengah tidak muncul sebagai baris nol', () => {
    const result = computeDeathsByCentury([
      rec('P1', '1450-01-01'),
      rec('P2', '1950-01-01'),
    ])
    expect(result.centuries).toEqual([
      { century: '1400', count: 1 },
      { century: '1900', count: 1 },
    ])
  })

  it('determinisme: dua urutan input menghasilkan output identik', () => {
    const a = [
      rec('P1', '1620-03-03'),
      rec('P2', '1815-07-04'),
      rec('P3', '1702-11-30'),
      rec('P4', null),
      rec('P5', '1988-02-29'),
    ]
    const b = [...a].reverse()
    expect(computeDeathsByCentury(a)).toEqual(computeDeathsByCentury(b))
  })

  it('throw bila records bukan array', () => {
    expect(() => computeDeathsByCentury('bukan array')).toThrow(
      'deaths-by-century: records harus array',
    )
  })

  it('throw bila entri bukan objek', () => {
    expect(() => computeDeathsByCentury([42])).toThrow(
      'deaths-by-century: entri harus objek',
    )
    expect(() => computeDeathsByCentury([null])).toThrow(
      'deaths-by-century: entri harus objek',
    )
  })

  it('throw bila personId bukan string', () => {
    expect(() => computeDeathsByCentury([{ personId: 7, deathDate: '1700-01-01' }])).toThrow(
      'deaths-by-century: personId harus string',
    )
  })

  it('throw bila personId string kosong', () => {
    expect(() => computeDeathsByCentury([rec('', '1700-01-01')])).toThrow(
      'deaths-by-century: personId tidak boleh string kosong',
    )
  })

  it('throw bila deathDate tipe salah selain string dan null', () => {
    expect(() => computeDeathsByCentury([{ personId: 'P1', deathDate: 17000101 }])).toThrow(
      'deaths-by-century: deathDate harus string atau null',
    )
    expect(() => computeDeathsByCentury([{ personId: 'P1', deathDate: undefined }])).toThrow(
      'deaths-by-century: deathDate harus string atau null',
    )
  })

  it('throw bila format bukan YYYY-MM-DD', () => {
    expect(() => computeDeathsByCentury([rec('P1', 'abc')])).toThrow(
      'deaths-by-century: format tanggal harus YYYY-MM-DD',
    )
    expect(() => computeDeathsByCentury([rec('P1', '1700-1-1')])).toThrow(
      'deaths-by-century: format tanggal harus YYYY-MM-DD',
    )
    expect(() => computeDeathsByCentury([rec('P1', '1700/01/01')])).toThrow(
      'deaths-by-century: format tanggal harus YYYY-MM-DD',
    )
  })

  it('throw bila bulan 00 atau 13 atau 31 April', () => {
    expect(() => computeDeathsByCentury([rec('P1', '1700-00-10')])).toThrow(
      'deaths-by-century: bulan harus 1 sampai 12',
    )
    expect(() => computeDeathsByCentury([rec('P1', '1700-13-10')])).toThrow(
      'deaths-by-century: bulan harus 1 sampai 12',
    )
    expect(() => computeDeathsByCentury([rec('P1', '1701-04-31')])).toThrow(
      'deaths-by-century: tanggal tidak valid secara kalender',
    )
  })

  it('29 Feb non-kabisat throw dan 29 Feb kabisat valid', () => {
    expect(() => computeDeathsByCentury([rec('P1', '1900-02-29')])).toThrow(
      'deaths-by-century: tanggal tidak valid secara kalender',
    )
    const result = computeDeathsByCentury([rec('P1', '2000-02-29')])
    expect(result.centuries).toEqual([{ century: '2000', count: 1 }])
  })

  it('deathDate null tidak kena parser format', () => {
    const result = computeDeathsByCentury([rec('P1', null)])
    expect(result.undated).toBe(1)
    expect(result.total).toBe(0)
  })
})
