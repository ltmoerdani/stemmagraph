// Test v464 unit 1b: penggabung continuation CONT/CONC pada pembacaan
// baris import. CONT menyambung payload dengan U+000A, CONC (warisan
// 5.x) menyambung langsung, EOL campur CRLF/LF/CR dihitung benar,
// dan integrasi charsetGate unit 1a (BOM strip, reject diteruskan).

import { describe, expect, it } from 'vitest'
import {
  resolveAfterCharsetGate,
  resolveLineContinuations,
  splitGedcomLines,
} from './lineContinuation'

describe('splitGedcomLines', () => {
  it('EOL campur CRLF LF CR dihitung satu pemisah per baris', () => {
    const lines = splitGedcomLines('0 HEAD\r\n1 NOTE a\n1 NAME b\r0 TRLR')
    expect(lines).toEqual(['0 HEAD', '1 NOTE a', '1 NAME b', '0 TRLR'])
  })

  it('baris terakhir tanpa EOL tetap dihasilkan', () => {
    expect(splitGedcomLines('0 HEAD\n1 CHAR UTF-8')).toEqual([
      '0 HEAD',
      '1 CHAR UTF-8',
    ])
  })

  it('teks kosong menghasilkan satu baris kosong', () => {
    expect(splitGedcomLines('')).toEqual([''])
  })
})

describe('resolveLineContinuations CONT', () => {
  it('CONT menggabungkan payload dengan U+000A', () => {
    const text = '0 HEAD\n1 NOTE baris satu\n2 CONT baris dua\n0 TRLR\n'
    const lines = resolveLineContinuations(text)
    const note = lines.find((l) => l.tag === 'NOTE')
    expect(note).toBeDefined()
    expect(note?.payload).toBe('baris satu\nbaris dua')
    expect(note?.line).toBe(2)
  })

  it('CONT beruntun menghasilkan banyak U+000A berurutan', () => {
    const text = '0 HEAD\n1 NOTE a\n2 CONT b\n2 CONT c\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('a\nb\nc')
  })

  it('payload kosong pada CONT tetap menyisipkan U+000A', () => {
    const text = '0 HEAD\n1 NOTE a\n2 CONT\n2 CONT b\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('a\n\nb')
  })

  it('CONT yatim tanpa induk level-1 dibiarkan jadi baris biasa', () => {
    const text = '0 HEAD\n2 CONT yatim\n0 TRLR\n'
    const lines = resolveLineContinuations(text)
    const yatim = lines.find((l) => l.tag === 'CONT')
    expect(yatim).toBeDefined()
    expect(yatim?.payload).toBe('yatim')
  })
})

describe('resolveLineContinuations CONC', () => {
  it('CONC menggabungkan tanpa newline', () => {
    const text = '0 HEAD\n1 NOTE pecah\n2 CONC lanjut\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('pecahlanjut')
  })

  it('CONC dan CONT campur mengikuti tag masing-masing', () => {
    const text = '0 HEAD\n1 NOTE a\n2 CONC b\n2 CONC c\n2 CONT d\n2 CONC e\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('abc\nde')
  })

  it('CONC pada payload panjang mempertahankan spasi di ujung potongan', () => {
    const text = '0 HEAD\n1 NOTE kata \n2 CONC sambung\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('kata sambung')
  })
})

describe('resolveLineContinuations struktur', () => {
  it('xref record level 0 terbaca dan level anak tidak bocor ke induk lain', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NOTE milik I1',
      '2 CONT kedua',
      '0 @I2@ INDI',
      '1 NAME x',
      '0 TRLR',
    ].join('\n')
    const lines = resolveLineContinuations(text)
    const i1 = lines.find((l) => l.xref === 'I1')
    expect(i1?.level).toBe(0)
    const note = lines.find((l) => l.tag === 'NOTE')
    expect(note?.payload).toBe('milik I1\nkedua')
    const name = lines.find((l) => l.tag === 'NAME')
    expect(name?.payload).toBe('x')
  })

  it('pindah induk level-1 me-reset continuation ke induk baru', () => {
    const text = '0 HEAD\n1 NOTE a\n1 NAME b\n2 CONT c\n0 TRLR\n'
    const lines = resolveLineContinuations(text)
    const name = lines.find((l) => l.tag === 'NAME')
    expect(name?.payload).toBe('b\nc')
  })

  it('nomor baris fisik dicatat dari baris pertama grup', () => {
    const text = '0 HEAD\n1 NOTE a\n2 CONT b\n2 CONC c\n0 TRLR\n'
    const note = resolveLineContinuations(text).find((l) => l.tag === 'NOTE')
    expect(note?.line).toBe(2)
  })
})

describe('resolveAfterCharsetGate integrasi unit 1a', () => {
  it('BOM di-strip dan continuation tetap tergabung setelah gate', () => {
    const text = '\uFEFF0 HEAD\n1 NOTE a\n2 CONT b\n0 TRLR\n'
    const hasil = resolveAfterCharsetGate(text)
    expect(hasil.ok).toBe(true)
    if (hasil.ok) {
      const note = hasil.lines.find((l) => l.tag === 'NOTE')
      expect(note?.payload).toBe('a\nb')
    }
  })

  it('EOL campur lolos gate lalu CONT tergabung benar', () => {
    const text = '0 HEAD\r\n1 NOTE a\r2 CONT b\n0 TRLR\r\n'
    const hasil = resolveAfterCharsetGate(text)
    expect(hasil.ok).toBe(true)
    if (hasil.ok) {
      const note = hasil.lines.find((l) => l.tag === 'NOTE')
      expect(note?.payload).toBe('a\nb')
    }
  })

  it('reject gate diteruskan fail-closed tanpa resolusi baris', () => {
    const text = '0 HEAD\n1 NOTE buruk\u0000\n0 TRLR\n'
    const hasil = resolveAfterCharsetGate(text)
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) {
      expect(hasil.errors.length).toBeGreaterThan(0)
      expect(hasil.errors[0].code).toBe('c0_control')
    }
  })

  it('C1 terlarang tetap ditolak meski payload ada CONT', () => {
    const hasil = resolveAfterCharsetGate('0 HEAD\n1 NOTE a\u0085b\n2 CONT c\n')
    expect(hasil.ok).toBe(false)
  })
})
