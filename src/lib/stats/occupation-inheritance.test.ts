import { describe, expect, it } from 'vitest'
import {
  computeOccupationInheritance,
  type OccupationInheritanceRecord,
} from './occupation-inheritance'

function rec(
  childId: string,
  childProfession: string | null,
  fatherProfession: string | null,
  motherProfession: string | null,
): OccupationInheritanceRecord {
  return { childId, childProfession, fatherProfession, motherProfession }
}

describe('computeOccupationInheritance', () => {
  it('flow dasar father dan mother dengan agregat multi anak', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', 'blacksmith', null),
      rec('C2', 'farmer', 'blacksmith', null),
      rec('C3', 'smith', 'blacksmith', 'weaver'),
    ])
    expect(result.flows).toEqual([
      { from: 'blacksmith', to: 'farmer', count: 2 },
      { from: 'blacksmith', to: 'smith', count: 1 },
      { from: 'weaver', to: 'smith', count: 1 },
    ])
    expect(result.totalFlows).toBe(4)
    expect(result.childrenWithFlow).toBe(3)
    expect(result.childrenExcluded).toBe(0)
  })

  it('satu anak dua-duanya parent berprofesi menghasilkan dua flow', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'cook', 'smith', 'weaver'),
    ])
    expect(result.flows).toEqual([
      { from: 'smith', to: 'cook', count: 1 },
      { from: 'weaver', to: 'cook', count: 1 },
    ])
    expect(result.totalFlows).toBe(2)
    expect(result.childrenWithFlow).toBe(1)
    expect(result.childrenExcluded).toBe(0)
  })

  it('father saja dan mother saja masing-masing satu flow', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', 'smith', null),
      rec('C2', 'baker', null, 'weaver'),
      rec('C3', 'cook', 'smith', 'weaver'),
    ])
    expect(result.flows).toEqual([
      { from: 'smith', to: 'cook', count: 1 },
      { from: 'smith', to: 'farmer', count: 1 },
      { from: 'weaver', to: 'baker', count: 1 },
      { from: 'weaver', to: 'cook', count: 1 },
    ])
    expect(result.totalFlows).toBe(4)
    expect(result.childrenWithFlow).toBe(3)
    expect(result.childrenExcluded).toBe(0)
  })

  it('urutan input diacak menghasilkan output identik', () => {
    const base = [
      rec('C1', 'farmer', 'blacksmith', null),
      rec('C2', 'smith', 'blacksmith', 'weaver'),
      rec('C3', 'baker', null, 'weaver'),
      rec('C4', 'cook', 'smith', 'weaver'),
    ]
    const shuffled = [
      rec('C3', 'baker', null, 'weaver'),
      rec('C4', 'cook', 'smith', 'weaver'),
      rec('C1', 'farmer', 'blacksmith', null),
      rec('C2', 'smith', 'blacksmith', 'weaver'),
    ]
    expect(computeOccupationInheritance(shuffled)).toEqual(
      computeOccupationInheritance(base),
    )
  })

  it('sort count DESC lalu tie from ASC lalu to ASC', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'zeta', 'alpha', null),
      rec('C2', 'beta', 'alpha', null),
      rec('C3', 'delta', 'chi', null),
      rec('C4', 'gamma', 'chi', null),
    ])
    expect(result.flows).toEqual([
      { from: 'alpha', to: 'beta', count: 1 },
      { from: 'alpha', to: 'zeta', count: 1 },
      { from: 'chi', to: 'delta', count: 1 },
      { from: 'chi', to: 'gamma', count: 1 },
    ])
    expect(result.totalFlows).toBe(4)
  })

  it('anak tanpa profession valid dibuang', () => {
    const result = computeOccupationInheritance([
      rec('C1', null, 'farmer', null),
      rec('C2', '', 'farmer', null),
      rec('C3', '   ', 'farmer', null),
    ])
    expect(result.flows).toEqual([])
    expect(result.totalFlows).toBe(0)
    expect(result.childrenWithFlow).toBe(0)
    expect(result.childrenExcluded).toBe(3)
  })

  it('anak berprofesi tanpa satu pun parent berprofesi dibuang', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', null, null),
      rec('C2', 'baker', '', '   '),
    ])
    expect(result.flows).toEqual([])
    expect(result.totalFlows).toBe(0)
    expect(result.childrenWithFlow).toBe(0)
    expect(result.childrenExcluded).toBe(2)
  })

  it('profession parent null kosong whitespace tidak valid, valid tetap dihitung', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', null, ''),
      rec('C2', 'baker', '   ', null),
      rec('C3', 'cook', ' tailor ', null),
    ])
    expect(result.flows).toEqual([{ from: 'tailor', to: 'cook', count: 1 }])
    expect(result.totalFlows).toBe(1)
    expect(result.childrenWithFlow).toBe(1)
    expect(result.childrenExcluded).toBe(2)
  })

  it('normalisasi collapse whitespace dan case-fold mengagregasi satu flow', () => {
    const result = computeOccupationInheritance([
      rec('C1', '  Farmer ', 'BLACKSMITH', null),
      rec('C2', 'FARMER', 'blacksmith  ', 'weaver'),
      rec('C3', 'farmer', null, '  WEA\tVER '),
    ])
    expect(result.flows).toEqual([
      { from: 'blacksmith', to: 'farmer', count: 2 },
      { from: 'wea ver', to: 'farmer', count: 1 },
      { from: 'weaver', to: 'farmer', count: 1 },
    ])
    expect(result.totalFlows).toBe(4)
    expect(result.childrenWithFlow).toBe(3)
    expect(result.childrenExcluded).toBe(0)
  })

  it('like-to-like farmer ke farmer tetap sah', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', 'Farmer', null),
      rec('C2', 'FARMER', ' farmer ', 'farmer'),
    ])
    expect(result.flows).toEqual([
      { from: 'farmer', to: 'farmer', count: 3 },
    ])
    expect(result.totalFlows).toBe(3)
    expect(result.childrenWithFlow).toBe(2)
    expect(result.childrenExcluded).toBe(0)
  })

  it('input kosong menghasilkan output nol penuh', () => {
    const result = computeOccupationInheritance([])
    expect(result).toEqual({
      flows: [],
      totalFlows: 0,
      childrenWithFlow: 0,
      childrenExcluded: 0,
    })
  })

  it('throw records bukan array', () => {
    expect(() => computeOccupationInheritance('bukan array')).toThrowError(
      /^occupation-inheritance: input records harus array$/,
    )
  })

  it('throw entri bukan objek ber-index', () => {
    const payload = [rec('C1', 'farmer', null, null), 42]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 1 bukan objek$/,
    )
  })

  it('throw childId bukan string ber-index', () => {
    const payload = [
      rec('C1', 'farmer', null, null),
      { childId: 42, childProfession: 'farmer', fatherProfession: null, motherProfession: null },
    ]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 1 childId harus string$/,
    )
  })

  it('throw childId string kosong ber-index', () => {
    const payload = [rec('', 'farmer', null, null)]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 0 childId tidak boleh string kosong$/,
    )
  })

  it('throw childProfession tipe salah ber-index', () => {
    const payload = [
      { childId: 'C1', childProfession: 42, fatherProfession: null, motherProfession: null },
    ]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 0 childProfession harus string atau null$/,
    )
  })

  it('throw fatherProfession tipe salah ber-index', () => {
    const payload = [
      { childId: 'C1', childProfession: 'farmer', fatherProfession: true, motherProfession: null },
    ]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 0 fatherProfession harus string atau null$/,
    )
  })

  it('throw motherProfession tipe salah ber-index', () => {
    const payload = [
      { childId: 'C1', childProfession: 'farmer', fatherProfession: null, motherProfession: 7 },
    ]
    expect(() => computeOccupationInheritance(payload)).toThrowError(
      /^occupation-inheritance: entri index 0 motherProfession harus string atau null$/,
    )
  })

  it('childId duplikat dihitung keduanya', () => {
    const result = computeOccupationInheritance([
      rec('C1', 'farmer', 'smith', null),
      rec('C1', 'baker', 'weaver', null),
    ])
    expect(result.flows).toEqual([
      { from: 'smith', to: 'farmer', count: 1 },
      { from: 'weaver', to: 'baker', count: 1 },
    ])
    expect(result.totalFlows).toBe(2)
    expect(result.childrenWithFlow).toBe(2)
    expect(result.childrenExcluded).toBe(0)
  })
})
