// Test v464 unit 1a: gate charset byte-level spec GEDCOM 7.
// Fail-closed, BOM opsional ter-strip, HEAD.CHAR tidak dituntut
// (tag CHAR dihapus di GEDCOM 7), EOL campur CR/LF/CRLF diterima.

import { describe, expect, it } from 'vitest'
import { runCharsetGate } from './charsetGate'

describe('runCharsetGate', () => {
  it('berkas bersih lolos tanpa perubahan teks', () => {
    const berkas = '0 HEAD\n1 NOTE teks biasa\n0 TRLR\n'
    const hasil = runCharsetGate(berkas)
    expect(hasil).toEqual({ ok: true, text: berkas })
  })

  it('byte C1 ditolak dengan pesan offset byte', () => {
    const hasil = runCharsetGate('AB\u0085CD')
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) {
      expect(hasil.errors[0].byteOffset).toBe(2)
      expect(hasil.errors[0].code).toBe('c1_control')
      expect(hasil.errors[0].message).toContain('offset byte 2')
    }
  })

  it('DEL 0x7F ditolak pada offset yang tepat', () => {
    const hasil = runCharsetGate('abc\u007Fdef')
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) {
      expect(hasil.errors[0].byteOffset).toBe(3)
      expect(hasil.errors[0].code).toBe('del')
    }
  })

  it('BOM awal opsional: lolos dan ter-strip', () => {
    const hasil = runCharsetGate('\uFEFF0 HEAD')
    expect(hasil).toEqual({ ok: true, text: '0 HEAD' })
  })

  it('noncharacter U+FFFE ditolak', () => {
    const hasil = runCharsetGate('x\uFFFEy')
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) {
      expect(hasil.errors[0].code).toBe('noncharacter')
      expect(hasil.errors[0].byteOffset).toBe(1)
    }
  })

  it('EOL campur CR, LF, CRLF lolos', () => {
    const berkas = '0 HEAD\r1 NOTE a\n2 CONT b\r\n0 TRLR\n'
    const hasil = runCharsetGate(berkas)
    expect(hasil.ok).toBe(true)
  })
})
