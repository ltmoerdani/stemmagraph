/**
 * Test enforcement tiga level RESN (GOAL v423 AC2e).
 *
 * Kontrak test PM: toStrictEqual (bukan toEqual), baseline structuredClone,
 * guard deepFreeze (Object.freeze shallow). Kasus mengikuti kontrak AC2e
 * GOAL plus kontrak evidence Gramps (merge paling membatasi, fail-closed).
 */

import { describe, expect, it } from 'vitest'
import { isResnHidden, isResnLocked, resolveResnEnforcement } from './resn-enforcement.js'
import { parseResnList } from './resn-list.js'
import { resolveResnComposite } from './resn.js'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

/** Jalankan enforcement pada input beku, assert input tak berubah. */
function frozen(verbatim: string | null) {
  const baseline = verbatim === null ? null : structuredClone(verbatim)
  const input = deepFreeze({ resnVerbatim: verbatim })
  const result = resolveResnEnforcement(input)
  expect(input.resnVerbatim).toStrictEqual(baseline)
  return result
}

describe('resolveResnEnforcement', () => {
  it('kasus 1: komposit LOCKED plus PRIVACY = hidden true locked true (paling membatasi menang)', () => {
    const result = frozen('LOCKED,PRIVACY')
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 2: verbatim token tak dikenal = paling membatasi fail-closed', () => {
    const result = frozen('SUPERSECRET')
    expect(result).toStrictEqual({ hidden: true, locked: true })
    expect(isResnHidden({ resnVerbatim: 'SUPERSECRET' })).toBe(true)
    expect(isResnLocked({ resnVerbatim: 'SUPERSECRET' })).toBe(true)
  })

  it('kasus 3: null, undefined, kosong, whitespace = baseline utuh', () => {
    expect(resolveResnEnforcement({ resnVerbatim: null })).toStrictEqual({ hidden: false, locked: false })
    expect(resolveResnEnforcement({ resnVerbatim: undefined })).toStrictEqual({ hidden: false, locked: false })
    expect(resolveResnEnforcement({ resnVerbatim: '' })).toStrictEqual({ hidden: false, locked: false })
    expect(resolveResnEnforcement({ resnVerbatim: '   ' })).toStrictEqual({ hidden: false, locked: false })
  })

  it('kasus 4: axis mutasi LOCKED menolak (isResnLocked true), CONFIDENTIAL tidak', () => {
    expect(isResnLocked({ resnVerbatim: 'LOCKED' })).toBe(true)
    expect(isResnLocked({ resnVerbatim: 'CONFIDENTIAL' })).toBe(false)
    expect(isResnLocked({ resnVerbatim: 'PRIVACY' })).toBe(false)
    expect(isResnLocked({ resnVerbatim: null })).toBe(false)
  })

  it('kasus 5: axis baca CONFIDENTIAL disembunyikan (isResnHidden true), PRIVACY tidak', () => {
    expect(isResnHidden({ resnVerbatim: 'CONFIDENTIAL' })).toBe(true)
    expect(isResnHidden({ resnVerbatim: 'LOCKED' })).toBe(true)
    expect(isResnHidden({ resnVerbatim: 'PRIVACY' })).toBe(false)
    expect(isResnHidden({ resnVerbatim: null })).toBe(false)
  })

  it('kasus 6: enforcement konsisten dengan resolver komposit AC1 untuk tiap kombinasi', () => {
    const combos = ['CONFIDENTIAL', 'PRIVACY', 'LOCKED', 'CONFIDENTIAL,PRIVACY', 'CONFIDENTIAL, LOCKED', 'LOCKED,PRIVACY', 'CONFIDENTIAL,PRIVACY,LOCKED']
    for (const raw of combos) {
      const expected = resolveResnComposite(parseResnList(raw))
      expect(frozen(raw)).toStrictEqual(expected)
    }
  })

  it('kasus 7: campuran dikenal dan tak dikenal tetap fail-closed paling membatasi', () => {
    const result = frozen('LOCKED,WEIRD_TOKEN')
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 8: parse toleran case lowercase locked tetap dikenali', () => {
    const result = frozen('locked')
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })
})
