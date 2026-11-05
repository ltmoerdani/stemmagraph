import { describe, expect, it } from 'vitest'

import { apiKeyError, maskApiKey } from './byo-key-mask'
import { ByoKeyError } from './byo-key-store'
import {
  isValidKeyFormat,
  maskKeySuffix,
} from './byo-key-internal'

describe('maskApiKey (micro-2 AC1)', () => {
  it('AC1 key panjang: hanya bintang plus 4 karakter akhir', () => {
    const masked = maskApiKey('sk-abcdef1234567890abcdef1234567890')
    expect(masked.startsWith('****')).toBe(true)
    expect(masked.endsWith('7890')).toBe(true)
    expect(masked).not.toContain('sk-abcdef')
    expect(masked.length).toBeLessThanOrEqual(8)
  })

  it('AC1 key pendek ditutup penuh tanpa suffix', () => {
    expect(maskApiKey('short')).toBe('****')
    expect(maskApiKey('')).toBe('****')
    expect(maskApiKey('12345678')).toBe('****')
  })

  it('AC1 non-string ditutup penuh', () => {
    expect(maskApiKey(undefined)).toBe('****')
    expect(maskApiKey(null)).toBe('****')
    expect(maskApiKey(42)).toBe('****')
  })
})

describe('apiKeyError (micro-2 AC1/AC3)', () => {
  it('pesan error generik tidak memuat potongan key', () => {
    const message = apiKeyError('invalid-format')
    expect(message).not.toContain('RAHASIA')
    expect(message).not.toContain('sk-')
    expect(message).toContain('invalid-format')
  })
})

describe('validasi format (micro-2 AC3)', () => {
  it('key valid lolos', () => {
    expect(isValidKeyFormat('abcdefgh')).toBe(true)
    expect(isValidKeyFormat('sk-proj-abc123DEF')).toBe(true)
  })

  it('key invalid ditolak: terlalu pendek', () => {
    expect(isValidKeyFormat('abc')).toBe(false)
    expect(isValidKeyFormat('')).toBe(false)
  })

  it('key invalid ditolak: whitespace di mana pun', () => {
    expect(isValidKeyFormat('abc defgh')).toBe(false)
    expect(isValidKeyFormat(' abcdefgh')).toBe(false)
    expect(isValidKeyFormat('abcdefgh ')).toBe(false)
    expect(isValidKeyFormat('abc\tdefg')).toBe(false)
  })

  it('key invalid ditolak: non-string', () => {
    expect(isValidKeyFormat(null)).toBe(false)
    expect(isValidKeyFormat(123)).toBe(false)
    expect(isValidKeyFormat(undefined)).toBe(false)
  })

  it('ByoKeyError berpesan generik tanpa isi key', () => {
    const err = new ByoKeyError('BYO_KEY_INVALID_FORMAT', 'invalid-format')
    expect(err.message).not.toContain('kunci-rahasia-abc')
    expect(err.code).toBe('BYO_KEY_INVALID_FORMAT')
    expect(err.name).toBe('ByoKeyError')
  })
})

describe('maskKeySuffix helper internal (micro-2 AC1)', () => {
  it('suffix terkontrol: max 4 karakter akhir', () => {
    expect(maskKeySuffix('abcdefghijkl')).toBe('****ijkl')
    expect(maskKeySuffix('abc')).toBe('****')
  })
})
