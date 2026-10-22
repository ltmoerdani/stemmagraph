import { describe, expect, it } from 'vitest'
import {
  computeMediaByType,
  type MediaEntry,
} from './media-by-type'

function media(mediaId: string, typeToken: string | null): MediaEntry {
  return { mediaId, typeToken }
}

describe('computeMediaByType', () => {
  it('kasus dasar grouping tiga token', () => {
    const result = computeMediaByType([
      media('M1', 'photo'),
      media('M2', 'photo'),
      media('M3', 'document'),
      media('M4', 'video'),
    ])
    expect(result.tokens).toEqual([
      { token: 'photo', count: 2 },
      { token: 'document', count: 1 },
      { token: 'video', count: 1 },
    ])
    expect(result.undatedCount).toBe(0)
    expect(result.total).toBe(4)
  })

  it('most-frequent first meski input acak', () => {
    const result = computeMediaByType([
      media('M1', 'audio'),
      media('M2', 'photo'),
      media('M3', 'photo'),
      media('M4', 'audio'),
      media('M5', 'photo'),
    ])
    expect(result.tokens.map((item) => item.token)).toEqual([
      'photo',
      'audio',
    ])
    expect(result.tokens[0]?.count).toBe(3)
    expect(result.tokens[1]?.count).toBe(2)
  })

  it('tie dua count sama urut localeCompare asc', () => {
    const result = computeMediaByType([
      media('M1', 'video'),
      media('M2', 'document'),
      media('M3', 'video'),
      media('M4', 'document'),
    ])
    expect(result.tokens).toEqual([
      { token: 'document', count: 2 },
      { token: 'video', count: 2 },
    ])
  })

  it('typeToken null masuk undatedCount tanpa throw', () => {
    const result = computeMediaByType([
      media('M1', 'photo'),
      media('M2', null),
      media('M3', null),
    ])
    expect(result.tokens).toEqual([{ token: 'photo', count: 1 }])
    expect(result.undatedCount).toBe(2)
    expect(result.total).toBe(3)
  })

  it('input kosong menghasilkan tokens kosong undatedCount 0 total 0', () => {
    const result = computeMediaByType([])
    expect(result.tokens).toEqual([])
    expect(result.undatedCount).toBe(0)
    expect(result.total).toBe(0)
  })

  it('total sama sum counts ditambah undatedCount', () => {
    const result = computeMediaByType([
      media('M1', 'photo'),
      media('M2', 'photo'),
      media('M3', 'document'),
      media('M4', 'audio'),
      media('M5', null),
      media('M6', null),
      media('M7', null),
    ])
    const sumCounts = result.tokens.reduce(
      (sum, item) => sum + item.count,
      0,
    )
    expect(result.total).toBe(sumCounts + result.undatedCount)
    expect(result.total).toBe(7)
  })

  it('case sensitivity: IMAGE dan image dua bucket beda', () => {
    const result = computeMediaByType([
      media('M1', 'IMAGE'),
      media('M2', 'image'),
      media('M3', 'IMAGE'),
    ])
    expect(result.tokens).toEqual([
      { token: 'IMAGE', count: 2 },
      { token: 'image', count: 1 },
    ])
  })

  it('mediaId duplikat tetap dihitung per entri', () => {
    const result = computeMediaByType([
      media('M1', 'photo'),
      media('M1', 'photo'),
      media('M1', 'document'),
    ])
    expect(result.tokens).toEqual([
      { token: 'photo', count: 2 },
      { token: 'document', count: 1 },
    ])
    expect(result.total).toBe(3)
  })

  it('token string kosong throw ber-index', () => {
    expect(() =>
      computeMediaByType([media('M1', 'photo'), media('M2', '')]),
    ).toThrowError(/media-by-type.*index 1.*typeToken/)
  })

  it('typeToken angka throw ber-index', () => {
    expect(() =>
      computeMediaByType([
        { mediaId: 'M1', typeToken: 42 },
      ]),
    ).toThrowError(/media-by-type.*index 0.*typeToken/)
  })

  it('mediaId string kosong throw ber-index', () => {
    expect(() =>
      computeMediaByType([media('', 'photo')]),
    ).toThrowError(/media-by-type.*index 0.*mediaId/)
  })

  it('media bukan array throw', () => {
    expect(() =>
      computeMediaByType({ mediaId: 'M1', typeToken: 'photo' }),
    ).toThrowError(/media-by-type.*harus array/)
    expect(() => computeMediaByType(null)).toThrowError(
      /media-by-type.*harus array/,
    )
  })

  it('entri bukan objek throw ber-index', () => {
    expect(() =>
      computeMediaByType([media('M1', 'photo'), 'photo' as never]),
    ).toThrowError(/media-by-type.*index 1.*bukan objek/)
    expect(() =>
      computeMediaByType([null as never]),
    ).toThrowError(/media-by-type.*index 0.*bukan objek/)
  })

  it('determinisme: dua urutan input berbeda hasil identik', () => {
    const a = computeMediaByType([
      media('M1', 'video'),
      media('M2', 'photo'),
      media('M3', 'photo'),
      media('M4', null),
      media('M5', 'document'),
      media('M6', 'photo'),
    ])
    const b = computeMediaByType([
      media('M6', 'photo'),
      media('M4', null),
      media('M3', 'photo'),
      media('M5', 'document'),
      media('M1', 'video'),
      media('M2', 'photo'),
    ])
    expect(a).toEqual(b)
    expect(a.tokens.map((item) => item.token)).toEqual([
      'photo',
      'document',
      'video',
    ])
  })
})
