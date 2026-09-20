/**
 * Test parseResnList/serializeResnList/resnListToPrivacyStatus (v130-i).
 *
 * Kasus mengikuti kontrak notes/298 dan bentuk resmi testfile
 * maximal70.ged ('CONFIDENTIAL, LOCKED' dengan comma-space).
 */

import { describe, expect, it } from 'vitest'
import {
  parseResnList,
  resnListToPrivacyStatus,
  serializeResnList,
} from './resn-list.js'

describe('parseResnList', () => {
  it('kasus 1 notes/298: RESN CONFIDENTIAL, LOCKED menghasilkan 2 nilai', () => {
    // Baris '1 RESN CONFIDENTIAL, LOCKED' pada import: nilai payload
    // 'CONFIDENTIAL, LOCKED' terurai menjadi dua level enumset.
    expect(parseResnList('CONFIDENTIAL, LOCKED')).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
  })

  it('toleran pemisah tanpa spasi sesuai ABNF listDelim', () => {
    expect(parseResnList('CONFIDENTIAL,LOCKED')).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
  })

  it('toleran lowercase', () => {
    expect(parseResnList('confidential')).toEqual(['CONFIDENTIAL'])
  })

  it('nilai tunggal PRIVACY', () => {
    expect(parseResnList('PRIVACY')).toEqual(['PRIVACY'])
  })

  it('item tak dikenal diabaikan tanpa error', () => {
    expect(parseResnList('CONFIDENTIAL, WEIRD, LOCKED')).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
  })

  it('null mengembalikan array kosong', () => {
    expect(parseResnList(null)).toEqual([])
  })

  it('undefined mengembalikan array kosong', () => {
    expect(parseResnList(undefined)).toEqual([])
  })

  it('string kosong mengembalikan array kosong', () => {
    expect(parseResnList('')).toEqual([])
  })

  it('item kosong akibat koma ganda dibuang', () => {
    expect(parseResnList('LOCKED, , CONFIDENTIAL')).toEqual([
      'LOCKED',
      'CONFIDENTIAL',
    ])
  })
})

describe('serializeResnList', () => {
  it('round-trip identitas dengan comma-space maximal70', () => {
    const raw = 'CONFIDENTIAL, LOCKED'
    expect(serializeResnList(parseResnList(raw))).toBe(raw)
  })

  it('array kosong mengembalikan string kosong', () => {
    expect(serializeResnList([])).toBe('')
  })

  it('nilai tunggal tanpa pemisah', () => {
    expect(serializeResnList(['PRIVACY'])).toBe('PRIVACY')
  })
})

describe('resnListToPrivacyStatus', () => {
  it('CONFIDENTIAL tunggal private', () => {
    expect(resnListToPrivacyStatus(['CONFIDENTIAL'])).toBe('private')
  })

  it('PRIVACY tunggal private', () => {
    expect(resnListToPrivacyStatus(['PRIVACY'])).toBe('private')
  })

  it('LOCKED tunggal private', () => {
    expect(resnListToPrivacyStatus(['LOCKED'])).toBe('private')
  })

  it('kombinasi CONFIDENTIAL+LOCKED private', () => {
    expect(resnListToPrivacyStatus(['CONFIDENTIAL', 'LOCKED'])).toBe('private')
  })

  it('array kosong null sesuai safe default asimetris v128', () => {
    expect(resnListToPrivacyStatus([])).toBeNull()
  })
})
