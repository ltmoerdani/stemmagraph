// Test STG v465 unit A1: pembalikan escape at-sign sisi import.
// Export vendor menggandakan @ awal; import harus membaliknya.
// Kasus: '@@Riwayat' jadi '@Riwayat', 'me@example.com' tetap,
// '@@' jadi '@', dan roundtrip export-import identik.

import { describe, expect, it } from 'vitest'
import { unescapeLineValue } from './lineValueUnescape'
import { placePayload } from './placePayload'

describe('unescapeLineValue import', () => {
  it("'@@Riwayat' di-collapse jadi '@Riwayat'", () => {
    expect(unescapeLineValue('@@Riwayat')).toBe('@Riwayat')
  })

  it("single @ di tengah tetap utuh: 'me@example.com'", () => {
    expect(unescapeLineValue('me@example.com')).toBe('me@example.com')
  })

  it("'@@' murni jadi '@'", () => {
    expect(unescapeLineValue('@@')).toBe('@')
  })

  it("nilai tanpa escape awal diteruskan apa adanya: 'Riwayat'", () => {
    expect(unescapeLineValue('Riwayat')).toBe('Riwayat')
  })

  it('string kosong diteruskan apa adanya', () => {
    expect(unescapeLineValue('')).toBe('')
  })
})

describe('roundtrip @Riwayat', () => {
  it("value '@Riwayat' export jadi '@@Riwayat' lalu import balik identik", () => {
    const exported = placePayload('@Riwayat')
    expect(exported).toBe('@@Riwayat')
    expect(unescapeLineValue(exported)).toBe('@Riwayat')
  })
})
