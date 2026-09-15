// Test token dan password share link (ADR 0010).
//
// Dua invariant:
// 1. Token: CSPRNG, base64url, panjang konsisten, tidak ada duplikat
//    dalam sampel besar.
// 2. Password: hash yang disimpan BUKAN plaintext, format bcrypt,
//    verifikasi menerima password benar dan menolak yang salah, dan
//    validator menolak input di luar batas sebelum hashing terjadi.

import { describe, expect, it } from 'vitest'
import {
  generateShareToken,
  SHARE_TOKEN_ENTROPY_BITS,
  SHARE_TOKEN_ENTROPY_BYTES,
} from './token'
import {
  hashSharePassword,
  isValidSharePassword,
  SHARE_PASSWORD_BCRYPT_ROUNDS,
  verifySharePassword,
} from './password'

describe('generateShareToken', () => {
  it('menghasilkan base64url murni tanpa padding', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('panjang konsisten dengan 256 bit entropi', () => {
    expect(SHARE_TOKEN_ENTROPY_BITS).toBe(256)
    expect(SHARE_TOKEN_ENTROPY_BYTES).toBe(32)
    // 32 byte base64url: 43 karakter, tanpa padding '='.
    const token = generateShareToken()
    expect(token).toHaveLength(43)
  })

  it('tidak menghasilkan duplikat dalam 2000 sampel', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i += 1) seen.add(generateShareToken())
    expect(seen.size).toBe(2000)
  })
})

describe('share password: hash bukan plaintext', () => {
  it('hash yang disimpan berbeda dari plaintext dan berformat bcrypt', async () => {
    const plain = 'rahasia-keluarga-123'
    const hash = await hashSharePassword(plain)
    expect(hash).not.toBe(plain)
    expect(hash).not.toContain(plain)
    expect(hash.startsWith('$2')).toBe(true)
    expect(hash).toHaveLength(60)
  })

  it('dua hash dari plaintext sama tidak identik (salt acak)', async () => {
    const a = await hashSharePassword('password-sama')
    const b = await hashSharePassword('password-sama')
    expect(a).not.toBe(b)
  })

  it('verifikasi menerima password benar, menolak yang salah', async () => {
    const hash = await hashSharePassword('kunci-pohon')
    expect(await verifySharePassword('kunci-pohon', hash)).toBe(true)
    expect(await verifySharePassword('kunci-pohon ', hash)).toBe(false)
    expect(await verifySharePassword('Kunci-Pohon', hash)).toBe(false)
    expect(await verifySharePassword('', hash)).toBe(false)
  })

  it('hash rusak mengembalikan false, bukan meledak', async () => {
    expect(await verifySharePassword('apa-aja', 'bukan-bcrypt')).toBe(false)
    expect(await verifySharePassword('apa-aja', '')).toBe(false)
  })

  it('rounds bcrypt sesuai konstanta yang didokumentasikan', async () => {
    expect(SHARE_PASSWORD_BCRYPT_ROUNDS).toBe(10)
    const hash = await hashSharePassword('cek-rounds')
    expect(hash.slice(4, 6)).toBe('10')
  })
})

describe('isValidSharePassword', () => {
  it('menolak sebelum hashing: bukan string, terlalu pendek, terlalu panjang', () => {
    expect(isValidSharePassword(undefined)).toBe(false)
    expect(isValidSharePassword(null)).toBe(false)
    expect(isValidSharePassword(12345678)).toBe(false)
    expect(isValidSharePassword('')).toBe(false)
    expect(isValidSharePassword('pendek')).toBe(false)
    expect(isValidSharePassword('a'.repeat(73))).toBe(false)
  })

  it('menerima string dalam batas, termasuk unicode', () => {
    expect(isValidSharePassword('sandi-panjang-ok')).toBe(true)
    expect(isValidSharePassword('kata sandi dengan spasi')).toBe(true)
    expect(isValidSharePassword('sandi-é-unicode')).toBe(true)
    expect(isValidSharePassword('a'.repeat(72))).toBe(true)
  })
})
