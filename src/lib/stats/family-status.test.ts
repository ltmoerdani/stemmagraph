import { describe, it, expect } from 'vitest'
import {
  computeFamilyStatus,
  type FamilyStatusResult,
} from './family-status'

const entry = (maritalStatus: string) => ({ maritalStatus })

const labelsOf = (res: FamilyStatusResult) => res.classes.map((c) => c.label)
const valueOf = (res: FamilyStatusResult, kind: string) => {
  const found = res.classes.find((c) => c.kind === kind)
  return found === undefined ? -1 : found.value
}

describe('computeFamilyStatus', () => {
  it('array kosong menghasilkan total 0 dan empat entri zero tanpa throw', () => {
    const res = computeFamilyStatus([])
    expect(res.total).toBe(0)
    expect(res.classes).toEqual([
      { label: 'Married', value: 0, kind: 'married' },
      { label: 'Single', value: 0, kind: 'single' },
      { label: 'Widowed', value: 0, kind: 'widowed' },
      { label: 'Divorced', value: 0, kind: 'divorced' },
    ])
  })

  it('satu entri married: value married 1, lainnya 0', () => {
    const res = computeFamilyStatus([entry('married')])
    expect(res.total).toBe(1)
    expect(valueOf(res, 'married')).toBe(1)
    expect(valueOf(res, 'single')).toBe(0)
    expect(valueOf(res, 'widowed')).toBe(0)
    expect(valueOf(res, 'divorced')).toBe(0)
  })

  it('satu entri single: value single 1, lainnya 0', () => {
    const res = computeFamilyStatus([entry('single')])
    expect(res.total).toBe(1)
    expect(valueOf(res, 'single')).toBe(1)
    expect(valueOf(res, 'married')).toBe(0)
  })

  it('satu entri widowed: value widowed 1, lainnya 0', () => {
    const res = computeFamilyStatus([entry('widowed')])
    expect(res.total).toBe(1)
    expect(valueOf(res, 'widowed')).toBe(1)
    expect(valueOf(res, 'married')).toBe(0)
  })

  it('satu entri divorced: value divorced 1, lainnya 0', () => {
    const res = computeFamilyStatus([entry('divorced')])
    expect(res.total).toBe(1)
    expect(valueOf(res, 'divorced')).toBe(1)
    expect(valueOf(res, 'married')).toBe(0)
  })

  it('campuran dua kind: hanya kind terkait yang terisi', () => {
    const res = computeFamilyStatus([
      entry('married'),
      entry('married'),
      entry('divorced'),
    ])
    expect(res.total).toBe(3)
    expect(valueOf(res, 'married')).toBe(2)
    expect(valueOf(res, 'divorced')).toBe(1)
    expect(valueOf(res, 'single')).toBe(0)
    expect(valueOf(res, 'widowed')).toBe(0)
  })

  it('campuran empat kind sekaligus', () => {
    const res = computeFamilyStatus([
      entry('married'),
      entry('single'),
      entry('widowed'),
      entry('divorced'),
      entry('married'),
      entry('widowed'),
    ])
    expect(res.total).toBe(6)
    expect(valueOf(res, 'married')).toBe(2)
    expect(valueOf(res, 'single')).toBe(1)
    expect(valueOf(res, 'widowed')).toBe(2)
    expect(valueOf(res, 'divorced')).toBe(1)
  })

  it('total akurat menjumlahkan value empat entri', () => {
    const input = [
      ...Array.from({ length: 12 }, () => entry('married')),
      ...Array.from({ length: 4 }, () => entry('single')),
      ...Array.from({ length: 9 }, () => entry('widowed')),
      ...Array.from({ length: 3 }, () => entry('divorced')),
    ]
    const res = computeFamilyStatus(input)
    expect(res.total).toBe(28)
    expect(res.classes.reduce((acc, c) => acc + c.value, 0)).toBe(res.total)
  })

  it('case-insensitive: MARRIED dan Widowed tetap terhitung', () => {
    const res = computeFamilyStatus([entry('MARRIED'), entry('Widowed')])
    expect(res.total).toBe(2)
    expect(valueOf(res, 'married')).toBe(1)
    expect(valueOf(res, 'widowed')).toBe(1)
  })

  it('trim spasi pinggir: nilai dengan spasi tetap kanonik', () => {
    const res = computeFamilyStatus([entry('  single  ')])
    expect(res.total).toBe(1)
    expect(valueOf(res, 'single')).toBe(1)
  })

  it('urutan output tetap Married Single Widowed Divorced apa pun isi input', () => {
    const res = computeFamilyStatus([
      entry('divorced'),
      entry('widowed'),
      entry('single'),
      entry('married'),
    ])
    expect(labelsOf(res)).toEqual(['Married', 'Single', 'Widowed', 'Divorced'])
  })

  it('setiap entri membawa kind padanan tanpa properti class', () => {
    const res = computeFamilyStatus([entry('married')])
    for (const c of res.classes) {
      expect(Object.keys(c).sort()).toEqual(['kind', 'label', 'value'])
    }
  })

  it('throw bila input bukan array', () => {
    expect(() => computeFamilyStatus('married')).toThrowError(/family-status:/)
    expect(() => computeFamilyStatus({ maritalStatus: 'married' })).toThrowError(
      /family-status:/,
    )
    expect(() => computeFamilyStatus(undefined)).toThrowError(/family-status:/)
  })

  it('throw bila entri bukan objek ber-index', () => {
    expect(() => computeFamilyStatus([42])).toThrowError(/family-status:/)
    expect(() => computeFamilyStatus(['married'])).toThrowError(/family-status:/)
    expect(() => computeFamilyStatus([null])).toThrowError(/family-status:/)
  })

  it('throw bila maritalStatus bukan string', () => {
    expect(() => computeFamilyStatus([{ maritalStatus: 1 }])).toThrowError(
      /family-status:/,
    )
    expect(() => computeFamilyStatus([{ maritalStatus: null }])).toThrowError(
      /family-status:/,
    )
    expect(() => computeFamilyStatus([{}])).toThrowError(/family-status:/)
  })

  it('throw bila nilai tak dikenal seperti engaged', () => {
    expect(() => computeFamilyStatus([entry('engaged')])).toThrowError(
      /family-status: nilai maritalStatus tidak kanonik: engaged/,
    )
  })

  it('throw bila entri berupa array walau berisi maritalStatus', () => {
    expect(() =>
      computeFamilyStatus([['married'] as unknown as Record<string, unknown>]),
    ).toThrowError(/family-status:/)
  })

  it('hasil deterministik untuk input identik', () => {
    const input = [entry('married'), entry('single')]
    expect(computeFamilyStatus(input)).toEqual(computeFamilyStatus(input))
  })
})
