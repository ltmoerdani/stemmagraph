import { describe, it, expect } from 'vitest'
import {
  computeChildlessFamilies,
} from './childless-families'

const entry = (label: string, value: number) => ({ label, value })

describe('computeChildlessFamilies', () => {
  it('array kosong menghasilkan total 0 dan classes kosong tanpa throw', () => {
    const res = computeChildlessFamilies([])
    expect(res.total).toBe(0)
    expect(res.classes).toEqual([])
  })

  it('satu entri: total dan classes mengikuti input', () => {
    const res = computeChildlessFamilies([entry('No children', 5)])
    expect(res.total).toBe(5)
    expect(res.classes).toEqual([
      { label: 'No children', value: 5, kind: 'other' },
    ])
  })

  it('dua entri: urutan dipertahankan apa adanya', () => {
    const res = computeChildlessFamilies([
      entry('Family childless', 3),
      entry('Have children', 7),
    ])
    expect(res.total).toBe(10)
    expect(res.classes.map((c) => c.label)).toEqual([
      'Family childless',
      'Have children',
    ])
  })

  it('total akurat menjumlahkan seluruh value', () => {
    const res = computeChildlessFamilies([
      entry('Have children', 12),
      entry('Childless', 4),
      entry('Unknown', 9),
    ])
    expect(res.total).toBe(25)
  })

  it('pemetaan kind childless: label berisi childless tanpa kualifikasi', () => {
    const res = computeChildlessFamilies([entry('Childless family', 2)])
    expect(res.classes[0].kind).toBe('childless')
  })

  it('pemetaan kind withChildren: varian have children', () => {
    const res = computeChildlessFamilies([entry('Have children', 1)])
    expect(res.classes[0].kind).toBe('withChildren')
  })

  it('pemetaan kind withChildren: varian with children dan has children', () => {
    const res = computeChildlessFamilies([
      entry('With children', 1),
      entry('Has children', 1),
    ])
    expect(res.classes.map((c) => c.kind)).toEqual([
      'withChildren',
      'withChildren',
    ])
  })

  it('pemetaan kind huruf besar campuran: case-insensitive', () => {
    const res = computeChildlessFamilies([entry('HAVE CHILDREN', 2)])
    expect(res.classes[0].kind).toBe('withChildren')
  })

  it('pemetaan kind other: label lain netral', () => {
    const res = computeChildlessFamilies([entry('No children', 2)])
    expect(res.classes[0].kind).toBe('other')
  })

  it('normalisasi tanda hubung dan spasi berlebih', () => {
    const res = computeChildlessFamilies([
      entry('Childless   family', 1),
      entry('With  children', 1),
    ])
    expect(res.classes.map((c) => c.kind)).toEqual([
      'childless',
      'withChildren',
    ])
  })

  it('input bukan array melempar Error ber-prefiks', () => {
    expect(() => computeChildlessFamilies('nope')).toThrowError(
      /^childless-families:/,
    )
  })

  it('entri bukan objek melempar Error ber-prefiks', () => {
    expect(() => computeChildlessFamilies([42])).toThrowError(
      /^childless-families:/,
    )
  })

  it('label kosong melempar Error ber-prefiks', () => {
    expect(() => computeChildlessFamilies([entry('   ', 1)]))
      .toThrowError(/^childless-families:/)
  })

  it('label bukan string melempar Error ber-prefiks', () => {
    expect(() =>
      computeChildlessFamilies([{ label: 7, value: 1 }]),
    ).toThrowError(/^childless-families:/)
  })

  it('value negatif melempar Error ber-prefiks', () => {
    expect(() => computeChildlessFamilies([entry('Childless', -1)]))
      .toThrowError(/^childless-families:/)
  })

  it('value pecahan melempar Error ber-prefiks', () => {
    expect(() => computeChildlessFamilies([entry('Childless', 1.5)]))
      .toThrowError(/^childless-families:/)
  })
})
