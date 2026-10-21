/**
 * Test v343 fase i modul top-religions sesuai kontrak bagian 5:
 * agregasi dasar, case-folded, urutan count desc, tie alphabetical,
 * limit default dan custom, limit invalid, input kosong, seri
 * unknown terpisah, lima bentuk throw ber-index, prefiks pesan
 * via regex /top-religions/, distinctCount, totalDated.
 */
import { describe, expect, it } from 'vitest'
import { computeTopReligions } from './top-religions'

function e(religion: string): { religion: string } {
  return { religion }
}

describe('computeTopReligions', () => {
  it('agregasi dasar: frekuensi dihitung per nilai ternormalisasi', () => {
    const r = computeTopReligions([e('Islam'), e('Kristen'), e('Islam')])
    expect(r.items).toEqual([
      { label: 'islam', count: 2 },
      { label: 'kristen', count: 1 },
    ])
  })

  it('case-folded merge: varian ejaan merge satu bucket', () => {
    const r = computeTopReligions([e('  Islam  '), e('ISLAM'), e('islam')])
    expect(r.items).toEqual([{ label: 'islam', count: 3 }])
  })

  it('urutan count desc: bucket terbesar lebih dulu', () => {
    const r = computeTopReligions([
      e('hindu'), e('islam'), e('islam'), e('islam'), e('hindu'),
    ])
    expect(r.items.map((i) => i.label)).toEqual(['islam', 'hindu'])
    expect(r.items.map((i) => i.count)).toEqual([3, 2])
  })

  it('tie alphabetical asc: count sama diurut label naik', () => {
    const r = computeTopReligions([
      e('buddha'), e('kristen'), e('hindu'), e('islam'),
    ])
    expect(r.items.map((i) => i.label)).toEqual([
      'buddha', 'hindu', 'islam', 'kristen',
    ])
  })

  it('limit default 8 memotong ranking lebih dari 8 bucket', () => {
    const entries = 'abcdefghij'.split('').map((c) => e(c))
    const r = computeTopReligions(entries)
    expect(r.items).toHaveLength(8)
    expect(r.limit).toBe(8)
    expect(r.distinctCount).toBe(10)
  })

  it('limit custom: slice sesuai limit yang diberikan', () => {
    const entries = [e('a'), e('b'), e('c'), e('d')]
    const r = computeTopReligions(entries, { limit: 2 })
    expect(r.items).toEqual([
      { label: 'a', count: 1 },
      { label: 'b', count: 1 },
    ])
    expect(r.limit).toBe(2)
  })

  it('limit 1: hanya item teratas', () => {
    const r = computeTopReligions([e('x'), e('x'), e('y')], { limit: 1 })
    expect(r.items).toEqual([{ label: 'x', count: 2 }])
  })

  it('limit invalid: 0 throw pesan prefiks top-religions', () => {
    expect(() => computeTopReligions([e('islam')], { limit: 0 })).toThrow(
      /top-religions/,
    )
  })

  it('limit invalid: negatif throw', () => {
    expect(() => computeTopReligions([e('islam')], { limit: -3 })).toThrow(
      'top-religions: limit wajib integer >= 1',
    )
  })

  it('limit invalid: pecahan dan NaN throw', () => {
    expect(() => computeTopReligions([], { limit: 1.5 })).toThrow(/top-religions/)
    expect(() => computeTopReligions([], { limit: Number.NaN })).toThrow(
      /top-religions/,
    )
  })

  it('input kosong: hasil nol semua, tanpa throw', () => {
    const r = computeTopReligions([])
    expect(r).toEqual({ items: [], totalDated: 0, distinctCount: 0, limit: 8 })
  })

  it('string kosong: seri unknown terpisah, tidak masuk ranking', () => {
    const r = computeTopReligions([e('islam'), e('   '), e('')])
    expect(r.items).toEqual([{ label: 'islam', count: 1 }])
    expect(r.totalDated).toBe(1)
    expect(r.distinctCount).toBe(1)
  })

  it('semua string kosong: items kosong, ringkasan nol', () => {
    const r = computeTopReligions([e(''), e('  ')])
    expect(r.items).toEqual([])
    expect(r.totalDated).toBe(0)
    expect(r.distinctCount).toBe(0)
  })

  it('throw: entries bukan array, pesan sebut prefiks', () => {
    expect(() => computeTopReligions('islam')).toThrow(
      'top-religions: entries bukan array',
    )
    expect(() => computeTopReligions(null)).toThrow(/top-religions/)
  })

  it('throw: entri bukan objek, pesan sebut index entri', () => {
    const call = () => computeTopReligions([e('islam'), 'kristen'])
    expect(call).toThrow('top-religions: entries[1] bukan objek')
    expect(call).toThrow(/top-religions/)
  })

  it('throw: entri null dan angka, pesan sebut index entri', () => {
    expect(() => computeTopReligions([null])).toThrow(
      'top-religions: entries[0] bukan objek',
    )
    expect(() => computeTopReligions([e('a'), 42])).toThrow(/entries\[1\]/)
  })

  it('throw: religion bukan string, pesan sebut index entri', () => {
    const bad = [{ religion: 7 }] as unknown[]
    expect(() => computeTopReligions(bad)).toThrow(
      'top-religions: entries[0].religion hilang atau bukan string',
    )
    const missing = [{}] as unknown[]
    expect(() => computeTopReligions(missing)).toThrow(/entries\[0\]/)
  })

  it('prefiks pesan: regex /top-religions/ pada semua bentuk throw', () => {
    const samples: Array<() => unknown> = [
      () => computeTopReligions('bukan array'),
      () => computeTopReligions([true]),
      () => computeTopReligions([{ religion: null }]),
      () => computeTopReligions([], { limit: 0 }),
    ]
    for (const call of samples) {
      expect(call).toThrow(/top-religions/)
    }
  })

  it('distinctCount tepat: bucket unik non-kosong', () => {
    const r = computeTopReligions([
      e('islam'), e('ISLAM'), e('kristen'), e(''), e('  '),
    ])
    expect(r.distinctCount).toBe(2)
  })

  it('totalDated tepat: hanya entri string non-kosong', () => {
    const r = computeTopReligions([
      e('islam'), e(' hindu '), e(''), e(' '), e('islam'),
    ])
    expect(r.totalDated).toBe(3)
    expect(r.distinctCount).toBe(2)
  })

  it('result shape: keys dan nilai limit terkanal di hasil', () => {
    const r = computeTopReligions([e('islam')], { limit: 3 })
    expect(Object.keys(r).sort()).toEqual([
      'distinctCount', 'items', 'limit', 'totalDated',
    ])
    expect(r.limit).toBe(3)
  })
})
