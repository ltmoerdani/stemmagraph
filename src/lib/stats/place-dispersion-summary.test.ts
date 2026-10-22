import { describe, expect, it } from 'vitest'
import { computePlaceDispersionSummary } from './place-dispersion-summary'

const entry = (personId: string, places: string[]) => ({ personId, places })

describe('computePlaceDispersionSummary', () => {
  it('kasus 1: multi orang, average dan totalPlaces akurat', () => {
    const result = computePlaceDispersionSummary([
      entry('p1', ['Amsterdam', 'Rotterdam']),
      entry('p2', ['Utrecht']),
      entry('p3', ['Den Haag', 'Leiden', 'Delft']),
    ])
    expect(result.sampled).toBe(3)
    expect(result.totalPlaces).toBe(6)
    expect(result.average).toBe(2)
    expect(result.distribution).toEqual({ '1': 1, '2': 1, '3': 1, '4': 0, '5+': 0 })
  })

  it('kasus 2: determinisme lintas urutan input acak', () => {
    const a = [
      entry('p1', ['A']),
      entry('p2', ['B', 'C']),
      entry('p3', ['D', 'E', 'F', 'G']),
    ]
    const b = [a[2], a[0], a[1]]
    expect(computePlaceDispersionSummary(a)).toEqual(computePlaceDispersionSummary(b))
  })

  it('kasus 3: satu orang satu tempat', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['Solo'])])
    expect(result).toEqual({
      average: 1,
      sampled: 1,
      totalPlaces: 1,
      distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5+': 0 },
    })
  })

  it('kasus 4: input kosong, distribution penuh nol, average 0', () => {
    const result = computePlaceDispersionSummary([])
    expect(result).toEqual({
      average: 0,
      sampled: 0,
      totalPlaces: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 },
    })
  })

  it('kasus 5: semua orang tanpa places, sampled 0', () => {
    const result = computePlaceDispersionSummary([entry('p1', []), entry('p2', [])])
    expect(result.sampled).toBe(0)
    expect(result.totalPlaces).toBe(0)
    expect(result.average).toBe(0)
    expect(result.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 })
  })

  it('kasus 6: dedup case-sensitive, Berlin dan berlin dua nilai', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['Berlin', 'berlin'])])
    expect(result.totalPlaces).toBe(2)
    expect(result.distribution['2']).toBe(1)
  })

  it('kasus 7: dedup nilai identik satu saja', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['Library', 'Library', 'Library'])])
    expect(result.totalPlaces).toBe(1)
    expect(result.distribution['1']).toBe(1)
  })

  it('kasus 8: trim whitespace dan skip string kosong', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['  Roma  ', '', '   ', 'Roma', 'N apoli'])])
    expect(result.totalPlaces).toBe(3)
    expect(result.distribution['3']).toBe(1)
  })

  it('kasus 9: orang tanpa tempat valid keluar dari sampled', () => {
    const result = computePlaceDispersionSummary([entry('p1', []), entry('p2', ['Kudus']), entry('p3', ['', ' '])])
    expect(result.sampled).toBe(1)
    expect(result.average).toBe(1)
    expect(result.distribution['1']).toBe(1)
  })

  it('kasus 10: boundary 4 masuk bucket 4', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['a', 'b', 'c', 'd'])])
    expect(result.distribution['4']).toBe(1)
    expect(result.distribution['5+']).toBe(0)
  })

  it('kasus 11: distinct 5 dan 7 masuk bucket 5+', () => {
    const result = computePlaceDispersionSummary([
      entry('p1', ['a', 'b', 'c', 'd', 'e']),
      entry('p2', ['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    ])
    expect(result.distribution['5+']).toBe(2)
    expect(result.average).toBe(6)
  })

  it('kasus 12: pembulatan 2 desimal', () => {
    const result = computePlaceDispersionSummary([
      entry('p1', ['a', 'b', 'c']),
      entry('p2', ['a']),
    ])
    expect(result.average).toBe(2)
    const result2 = computePlaceDispersionSummary([
      entry('p1', ['a', 'b']),
      entry('p2', ['a', 'b', 'c']),
      entry('p3', ['a']),
    ])
    expect(result2.average).toBe(2)
    const result3 = computePlaceDispersionSummary([
      entry('p1', ['a', 'b']),
      entry('p2', ['a']),
    ])
    expect(result3.average).toBe(1.5)
    const result4 = computePlaceDispersionSummary([
      entry('p1', ['a', 'b', 'c', 'd', 'e']),
      entry('p2', ['a', 'b', 'c']),
      entry('p3', ['a']),
    ])
    expect(result4.average).toBe(3)
  })

  it('kasus 13: duplikat personId dihitung dua sampel terpisah', () => {
    const result = computePlaceDispersionSummary([entry('p1', ['a']), entry('p1', ['b', 'c'])])
    expect(result.sampled).toBe(2)
    expect(result.totalPlaces).toBe(3)
    expect(result.average).toBe(1.5)
  })

  it('kasus 14: throw records bukan array', () => {
    expect(() => computePlaceDispersionSummary('bukan')).toThrowError(/place-dispersion-summary/)
    expect(() => computePlaceDispersionSummary(null)).toThrowError(/place-dispersion-summary/)
    expect(() => computePlaceDispersionSummary({})).toThrowError(/place-dispersion-summary/)
  })

  it('kasus 15: throw entri bukan objek dan personId tidak sah', () => {
    expect(() => computePlaceDispersionSummary([42])).toThrowError(/index 0 harus objek/)
    expect(() => computePlaceDispersionSummary([entry('p1', ['a']), 'x'])).toThrowError(/index 1 harus objek/)
    expect(() => computePlaceDispersionSummary([entry(42, ['a'])])).toThrowError(/personId harus string/)
    expect(() => computePlaceDispersionSummary([entry('', ['a'])])).toThrowError(/personId tidak boleh string kosong/)
  })

  it('kasus 16: throw places dan elemen places tidak sah', () => {
    expect(() => computePlaceDispersionSummary([entry('p1', 'bukan')])).toThrowError(/places harus array/)
    expect(() => computePlaceDispersionSummary([entry('p1', ['a', 7])])).toThrowError(
      /elemen places index 1 harus string/,
    )
  })

  it('kasus 17: pembulatan 2 desimal pecahan', () => {
    const result = computePlaceDispersionSummary([
      entry('p1', ['a', 'b', 'c']),
      entry('p2', ['a']),
      entry('p3', ['a', 'b']),
    ])
    expect(result.average).toBe(2)
  })

  it('kasus 18: pembulatan pecahan desimal nyata', () => {
    const result = computePlaceDispersionSummary([
      entry('p1', ['a']),
      entry('p2', ['a', 'b']),
      entry('p3', ['a', 'b', 'c', 'd']),
    ])
    expect(result.average).toBe(2.33)
  })
})
