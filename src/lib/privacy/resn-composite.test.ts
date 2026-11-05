/**
 * Test resolver komposit RESN multi nilai (GOAL v423 AC1).
 *
 * Kontrak evidence Gramps: merge OR paling membatasi pada dua axis
 * (hidden untuk baca, locked untuk mutasi). Kontrak test: toStrictEqual,
 * baseline di-clone structuredClone sebelum assert, deepFreeze karena
 * Object.freeze shallow, dan assert tanpa mutasi input.
 */

import { describe, expect, it } from 'vitest'
import type { ResnLevel } from './resn.js'
import { resolveResnComposite } from './resn.js'
import { parseResnList } from './resn-list.js'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

/**
 * Jalankan resolver pada input beku (deepFreeze, bukan Object.freeze
 * shallow), lalu assert hasil dan assert input tidak berubah terhadap
 * baseline structuredClone.
 */
function resolveFrozen(
  input: ResnLevel[],
): { result: { hidden: boolean; locked: boolean }; baseline: ResnLevel[] } {
  const baseline = structuredClone(input)
  const frozen = deepFreeze(input)
  const result = resolveResnComposite(frozen)
  expect(input).toStrictEqual(baseline)
  return { result, baseline }
}

describe('resolveResnComposite', () => {
  it('kasus 1: multi nilai dipisah koma LOCKED,PRIVACY menghasilkan locked', () => {
    const input = parseResnList('LOCKED,PRIVACY')
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 2: multi nilai comma-space LOCKED, PRIVACY sesuai ABNF listDelim', () => {
    const input = parseResnList('LOCKED, PRIVACY')
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 3: gabungan LOCKED+PRIVACY = LOCKED pada komposit', () => {
    const input: ResnLevel[] = ['LOCKED', 'PRIVACY']
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 4: kosong+PRIVACY = PRIVACY, hidden false locked false', () => {
    const input: ResnLevel[] = ['PRIVACY']
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: false, locked: false })
  })

  it('kasus 5: CONFIDENTIAL saja = hidden true locked false', () => {
    const input: ResnLevel[] = ['CONFIDENTIAL']
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: false })
  })

  it('kasus 6: LOCKED saja = hidden true locked true', () => {
    const input: ResnLevel[] = ['LOCKED']
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 7: duplikat dedupe idempoten, dua kali pemanggilan hasil sama', () => {
    const input: ResnLevel[] = ['LOCKED', 'LOCKED', 'PRIVACY', 'LOCKED']
    const first = resolveResnComposite(input)
    const second = resolveResnComposite(input)
    expect(first).toStrictEqual(second)
    expect(first).toStrictEqual({ hidden: true, locked: true })
    expect(second).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 8: item kosong string ditolak dengan error jelas', () => {
    const input = ['', 'LOCKED'] as unknown as ResnLevel[]
    const baseline = structuredClone(input)
    expect(() => resolveResnComposite(input)).toThrowError(
      'RESN item kosong ditolak: setiap item harus berupa nilai enumset CONFIDENTIAL, PRIVACY, atau LOCKED',
    )
    expect(input).toStrictEqual(baseline)
  })

  it('kasus 9: LOCKED+CONFIDENTIAL axis mutasi locked, axis baca hidden', () => {
    const input: ResnLevel[] = ['LOCKED', 'CONFIDENTIAL']
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: true, locked: true })
  })

  it('kasus 10: daftar kosong menghasilkan komposit tanpa pembatasan', () => {
    const input: ResnLevel[] = []
    const { result } = resolveFrozen(input)
    expect(result).toStrictEqual({ hidden: false, locked: false })
  })
})
