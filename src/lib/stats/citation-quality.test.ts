import { describe, expect, it } from 'vitest'
import { computeCitationQuality } from './citation-quality'

describe('computeCitationQuality', () => {
  it('kasus 1: input kosong menghasilkan null, kosong vs terisi dibedakan', () => {
    expect(computeCitationQuality([])).toBeNull()
  })

  it('kasus 2: distribusi enum 0-3 benar', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '3' },
      { sourcePointer: '@S1@', quay: '1' },
      { sourcePointer: '@S2@', quay: '3' },
      { sourcePointer: '@S2@', quay: '2' },
      { sourcePointer: '@S3@', quay: '0' },
    ])
    expect(r).not.toBeNull()
    expect(r!.total).toBe(5)
    expect(r!.quayValues).toEqual([
      { value: '0', count: 1 },
      { value: '1', count: 1 },
      { value: '2', count: 1 },
      { value: '3', count: 2 },
    ])
    expect(r!.missingQuay).toBe(0)
    expect(r!.invalidQuay).toEqual([])
  })

  it('kasus 3: quay undefined masuk missingQuay bukan quayValues', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@' },
      { sourcePointer: '@S2@', quay: '2' },
      { sourcePointer: '@S3@' },
    ])
    expect(r!.missingQuay).toBe(2)
    expect(r!.quayValues).toEqual([{ value: '2', count: 1 }])
  })

  it('kasus 4: quay 0 masuk quayValues BUKAN missing, inti kosong vs 0 dibedakan', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '0' },
      { sourcePointer: '@S2@' },
    ])
    expect(r!.quayValues).toEqual([{ value: '0', count: 1 }])
    expect(r!.missingQuay).toBe(1)
  })

  it('kasus 5: quay non-standar verbatim tanpa trim tanpa case folding', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '5' },
      { sourcePointer: '@S1@', quay: 'primary' },
      { sourcePointer: '@S2@', quay: ' ' },
    ])
    expect(r!.invalidQuay).toEqual([
      { value: ' ', count: 1 },
      { value: '5', count: 1 },
      { value: 'primary', count: 1 },
    ])
    expect(r!.quayValues).toEqual([])
  })

  it('kasus 6: quay string kosong masuk invalidQuay tanpa throw', () => {
    const r = computeCitationQuality([{ sourcePointer: '@S1@', quay: '' }])
    expect(r!.invalidQuay).toEqual([{ value: '', count: 1 }])
  })

  it('kasus 7: invalidQuay distinct plus count berulang', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '9' },
      { sourcePointer: '@S2@', quay: '9' },
      { sourcePointer: '@S3@', quay: '9' },
      { sourcePointer: '@S4@', quay: 'x' },
    ])
    expect(r!.invalidQuay).toEqual([
      { value: '9', count: 3 },
      { value: 'x', count: 1 },
    ])
  })

  it('kasus 8: quayValues hanya count >= 1 urut value ASC', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '2' },
      { sourcePointer: '@S2@', quay: '0' },
      { sourcePointer: '@S2@', quay: '2' },
      { sourcePointer: '@S3@', quay: '2' },
    ])
    expect(r!.quayValues).toEqual([
      { value: '0', count: 1 },
      { value: '2', count: 3 },
    ])
  })

  it('kasus 9: invalidQuay urut localeCompare asc deterministik lintas urutan input', () => {
    const a = computeCitationQuality([
      { sourcePointer: '@S1@', quay: 'zz' },
      { sourcePointer: '@S1@', quay: 'AA' },
      { sourcePointer: '@S2@', quay: 'mm' },
    ])
    const b = computeCitationQuality([
      { sourcePointer: '@S2@', quay: 'mm' },
      { sourcePointer: '@S1@', quay: 'AA' },
      { sourcePointer: '@S1@', quay: 'zz' },
    ])
    expect(a).toEqual(b)
    expect(a!.invalidQuay.map((x) => x.value)).toEqual(['AA', 'mm', 'zz'])
  })

  it('kasus 10: notes withNote withoutNote', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', note: 'sumber arsip keluarga' },
      { sourcePointer: '@S2@', note: 'wawancara 1990' },
      { sourcePointer: '@S3@' },
    ])
    expect(r!.notes).toEqual({ withNote: 2, withoutNote: 1 })
  })

  it('kasus 11: note string kosong dihitung withoutNote', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', note: '' },
      { sourcePointer: '@S2@', note: 'isi' },
    ])
    expect(r!.notes).toEqual({ withNote: 1, withoutNote: 1 })
  })

  it('kasus 12: invariant total = quayValues + missingQuay + invalidQuay', () => {
    const r = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '3' },
      { sourcePointer: '@S1@', quay: '3' },
      { sourcePointer: '@S2@', quay: '7' },
      { sourcePointer: '@S3@', quay: '8' },
      { sourcePointer: '@S4@' },
      { sourcePointer: '@S5@' },
    ])
    const sumValid = r!.quayValues.reduce((s, x) => s + x.count, 0)
    const sumInvalid = r!.invalidQuay.reduce((s, x) => s + x.count, 0)
    expect(r!.total).toBe(sumValid + r!.missingQuay + sumInvalid)
    expect(r!.total).toBe(6)
  })

  it('kasus 13: determinisme lintas urutan input, output identik', () => {
    const a = computeCitationQuality([
      { sourcePointer: '@S1@', quay: '1', note: 'n1' },
      { sourcePointer: '@S2@', quay: '3' },
      { sourcePointer: '@S3@', quay: '0', note: 'n2' },
      { sourcePointer: '@S4@' },
    ])
    const b = computeCitationQuality([
      { sourcePointer: '@S4@' },
      { sourcePointer: '@S3@', quay: '0', note: 'n2' },
      { sourcePointer: '@S2@', quay: '3' },
      { sourcePointer: '@S1@', quay: '1', note: 'n1' },
    ])
    expect(a).toEqual(b)
  })

  it('kasus 14: sourcePointer string kosong throw ber-index', () => {
    expect(() => computeCitationQuality([{ sourcePointer: '' }])).toThrowError(
      /citation-quality\[0\]/
    )
  })

  it('kasus 15: quay tipe angka throw ber-index', () => {
    expect(() =>
      // @ts-expect-error uji tipe salah sengaja
      computeCitationQuality([{ sourcePointer: '@S1@', quay: 3 }])
    ).toThrowError(/citation-quality\[0\]/)
  })

  it('kasus 16: note tipe angka throw ber-index', () => {
    expect(() =>
      // @ts-expect-error uji tipe salah sengaja
      computeCitationQuality([{ sourcePointer: '@S1@', note: 1 }])
    ).toThrowError(/citation-quality\[0\]/)
  })

  it('kasus 17: entri bukan objek throw ber-index', () => {
    expect(() =>
      // @ts-expect-error uji tipe salah sengaja
      computeCitationQuality([null])
    ).toThrowError(/citation-quality\[0\]/)
    expect(() =>
      // @ts-expect-error uji tipe salah sengaja
      computeCitationQuality(['@S1@'])
    ).toThrowError(/citation-quality\[0\]/)
  })
})
