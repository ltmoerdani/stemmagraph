// Unit test parseEventDateExt (v459 fase 1): periode FROM/TO, phrase INT,
// dan jaminan delegasi bahwa bentuk yang sudah ditangani parseEventDate
// tidak berubah perilaku.
import { describe, it, expect } from 'vitest'
import { parseEventDateExt } from './parseEventDateExt'

describe('parseEventDateExt: periode FROM/TO', () => {
  it('FROM x TO y sah menghasilkan PERIOD kedua sisi', () => {
    const r = parseEventDateExt('FROM 1900 TO 1910')
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') {
      expect(r.from).toEqual({ year: 1900 })
      expect(r.to).toEqual({ year: 1910 })
      expect(r.originalDateString).toBe('FROM 1900 TO 1910')
    }
  })

  it('FROM dengan hari-bulan-tahun penuh', () => {
    const r = parseEventDateExt('FROM 12 JAN 1900 TO 3 MAR 1905')
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') {
      expect(r.from).toEqual({ year: 1900, month: 1, day: 12 })
      expect(r.to).toEqual({ year: 1905, month: 3, day: 3 })
    }
  })

  it('FROM saja menghasilkan PERIOD dengan to null', () => {
    const r = parseEventDateExt('FROM 1900')
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') {
      expect(r.from).toEqual({ year: 1900 })
      expect(r.to).toBeNull()
    }
  })

  it('TO saja menghasilkan PERIOD dengan from null', () => {
    const r = parseEventDateExt('TO 1910')
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') {
      expect(r.from).toBeNull()
      expect(r.to).toEqual({ year: 1910 })
    }
  })

  it('sisi tak sah (BET di dalam FROM) jatuh ke ABOUT tanpa mengarang', () => {
    const r = parseEventDateExt('FROM BET 1900 AND 1901 TO 1910')
    expect(r.dateKind).toBe('ABOUT')
    if (r.dateKind === 'ABOUT') {
      expect(r.originalDateString).toBe('FROM BET 1900 AND 1901 TO 1910')
    }
  })

  it('tanggal mustahil pada sisi TO jatuh ke ABOUT', () => {
    const r = parseEventDateExt('FROM 1900 TO 31 FEB 1901')
    expect(r.dateKind).toBe('ABOUT')
  })

  it('kata kunci case-insensitive', () => {
    const r = parseEventDateExt('from 1900 to 1910')
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') {
      expect(r.from).toEqual({ year: 1900 })
      expect(r.to).toEqual({ year: 1910 })
    }
  })
})

describe('parseEventDateExt: phrase INT', () => {
  it('INT menghasilkan PHRASE verbatim', () => {
    const r = parseEventDateExt('INT 2 SEP 1739 (Baptism)')
    expect(r.dateKind).toBe('PHRASE')
    if (r.dateKind === 'PHRASE') {
      expect(r.phrase).toBe('2 SEP 1739 (Baptism)')
      expect(r.originalDateString).toBe('INT 2 SEP 1739 (Baptism)')
    }
  })

  it('phrase kapitalisasi asli dipertahankan', () => {
    const r = parseEventDateExt('INT Tahun Tak Diketahui')
    expect(r.dateKind).toBe('PHRASE')
    if (r.dateKind === 'PHRASE') {
      expect(r.phrase).toBe('Tahun Tak Diketahui')
    }
  })
})

describe('parseEventDateExt: delegasi ke parseEventDate', () => {
  it('EXACT tidak berubah', () => {
    const r = parseEventDateExt('12 JAN 1900')
    expect(r.dateKind).toBe('EXACT')
    if (r.dateKind === 'EXACT') {
      expect(r.year).toBe(1900)
      expect(r.month).toBe(1)
      expect(r.day).toBe(12)
    }
  })

  it('ABT tetap ABOUT', () => {
    const r = parseEventDateExt('ABT 1900')
    expect(r.dateKind).toBe('ABOUT')
  })

  it('BET..AND tetap RANGE existing', () => {
    const r = parseEventDateExt('BET 1900 AND 1910')
    expect(r.dateKind).toBe('RANGE')
    if (r.dateKind === 'RANGE') {
      expect(r.from).toEqual({ year: 1900 })
      expect(r.to).toEqual({ year: 1910 })
    }
  })

  it('input sampah jatuh ABOUT tanpa lempar', () => {
    const r = parseEventDateExt('tidak jelas')
    expect(r.dateKind).toBe('ABOUT')
  })
})
