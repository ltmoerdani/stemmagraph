// Unit test parser tanggal GEDCOM komposit (S1 fase 3 persiapan, item parser).
//
// Fokus: seluruh dateKind (EXACT/ABOUT/BEFORE/AFTER/RANGE), fallback fail-safe
// (gagal urai tidak melempar dan tidak mengarang presisi), serta edge case:
// string kosong, whitespace, teks acak, tanggal parsial, BET tanpa AND,
// tanggal mustahil, escape kalender, dan jaminan originalDateString utuh.

import { describe, expect, it } from 'vitest'
import { parseEventDate } from './parseEventDate'

describe('parseEventDate - EXACT', () => {
  it('urai tanggal lengkap hari bulan tahun', () => {
    const r = parseEventDate('12 JAN 1900')
    expect(r).toMatchObject({ dateKind: 'EXACT', day: 12, month: 1, year: 1900 })
  })

  it('urai tahun saja', () => {
    const r = parseEventDate('1900')
    expect(r).toMatchObject({ dateKind: 'EXACT', year: 1900 })
    expect(r).not.toHaveProperty('day')
    expect(r).not.toHaveProperty('month')
  })

  it('urai bulan dan tahun tanpa hari', () => {
    const r = parseEventDate('JAN 1900')
    expect(r).toMatchObject({ dateKind: 'EXACT', month: 1, year: 1900 })
    expect(r).not.toHaveProperty('day')
  })

  it('case-insensitive untuk bulan', () => {
    expect(parseEventDate('12 jan 1900')).toMatchObject({ dateKind: 'EXACT', day: 12, month: 1 })
    expect(parseEventDate('mar 1902')).toMatchObject({ dateKind: 'EXACT', month: 3, year: 1902 })
  })

  it('lipat whitespace berlebih', () => {
    const r = parseEventDate('  12   JAN   1900  ')
    expect(r).toMatchObject({ dateKind: 'EXACT', day: 12, month: 1, year: 1900 })
  })

  it('29 FEB hanya sah pada tahun kabisat', () => {
    expect(parseEventDate('29 FEB 2000')).toMatchObject({ dateKind: 'EXACT', year: 2000 })
    expect(parseEventDate('29 FEB 1900')).toMatchObject({ dateKind: 'ABOUT' })
  })
})

describe('parseEventDate - ABOUT / BEFORE / AFTER', () => {
  it('ABT memetakan ke ABOUT dengan komponen tahun', () => {
    expect(parseEventDate('ABT 1900')).toMatchObject({ dateKind: 'ABOUT', year: 1900 })
  })

  it('ABOUT dengan tanggal lengkap', () => {
    expect(parseEventDate('ABOUT 12 JAN 1900')).toMatchObject({
      dateKind: 'ABOUT', day: 12, month: 1, year: 1900,
    })
  })

  it('BEF dan BEFORE memetakan ke BEFORE', () => {
    expect(parseEventDate('BEF MAR 1902')).toMatchObject({ dateKind: 'BEFORE', month: 3, year: 1902 })
    expect(parseEventDate('BEFORE 1 JAN 1990')).toMatchObject({
      dateKind: 'BEFORE', day: 1, month: 1, year: 1990,
    })
  })

  it('AFT dan AFTER memetakan ke AFTER', () => {
    expect(parseEventDate('AFT 1900')).toMatchObject({ dateKind: 'AFTER', year: 1900 })
    expect(parseEventDate('after 5 DEC 1850')).toMatchObject({
      dateKind: 'AFTER', day: 5, month: 12, year: 1850,
    })
  })

  it('ABT dengan sisi tanggal rusak jatuh ke ABOUT tanpa komponen', () => {
    const r = parseEventDate('ABT garbage')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: 'ABT garbage' })
    expect(r).not.toHaveProperty('year')
    expect(r).not.toHaveProperty('month')
    expect(r).not.toHaveProperty('day')
  })
})

describe('parseEventDate - RANGE', () => {
  it('BET AND dengan tahun saja', () => {
    const r = parseEventDate('BET 1900 AND 1910')
    expect(r).toMatchObject({
      dateKind: 'RANGE',
      from: { year: 1900 },
      to: { year: 1910 },
    })
  })

  it('BET AND dengan presisi campuran per sisi', () => {
    const r = parseEventDate('BET 12 JAN 1900 AND MAR 1902')
    expect(r).toMatchObject({
      dateKind: 'RANGE',
      from: { day: 12, month: 1, year: 1900 },
      to: { month: 3, year: 1902 },
    })
  })
})

describe('parseEventDate - fallback fail-safe', () => {
  it('string kosong menghasilkan ABOUT tanpa komponen', () => {
    const r = parseEventDate('')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: '' })
    expect(r).not.toHaveProperty('year')
  })

  it('whitespace saja menghasilkan ABOUT', () => {
    expect(parseEventDate('   ')).toMatchObject({ dateKind: 'ABOUT' })
  })

  it('teks acak tanpa tanggal menghasilkan ABOUT', () => {
    const r = parseEventDate('teks acak bukan tanggal')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: 'teks acak bukan tanggal' })
    expect(r).not.toHaveProperty('year')
  })

  it('BET tanpa AND jatuh ke ABOUT, originalDateString utuh', () => {
    const r = parseEventDate('BET 1900')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: 'BET 1900' })
    expect(r).not.toHaveProperty('year')
  })

  it('BET AND dengan sisi tujuan kosong jatuh ke ABOUT', () => {
    const r = parseEventDate('BET 1900 AND')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: 'BET 1900 AND' })
  })

  it('tanggal mustahil 31 FEB jatuh ke ABOUT tanpa mengarang presisi', () => {
    const r = parseEventDate('31 FEB 1900')
    expect(r).toMatchObject({ dateKind: 'ABOUT', originalDateString: '31 FEB 1900' })
    expect(r).not.toHaveProperty('day')
    expect(r).not.toHaveProperty('year')
  })

  it('kata kunci tanpa tanggal menghasilkan ABOUT', () => {
    expect(parseEventDate('ABT')).toMatchObject({ dateKind: 'ABOUT' })
    expect(parseEventDate('BEFORE')).toMatchObject({ dateKind: 'ABOUT' })
  })

  it('hari 0 dan 32 ditolak', () => {
    expect(parseEventDate('0 JAN 1900')).toMatchObject({ dateKind: 'ABOUT' })
    expect(parseEventDate('32 JAN 1900')).toMatchObject({ dateKind: 'ABOUT' })
  })

  it('sintaks FROM TO di luar lingkup jatuh ke ABOUT', () => {
    expect(parseEventDate('FROM 1900 TO 1910')).toMatchObject({
      dateKind: 'ABOUT',
      originalDateString: 'FROM 1900 TO 1910',
    })
  })
})

describe('parseEventDate - kontrak umum', () => {
  it('originalDateString mengembalikan input verbatim termasuk escape kalender', () => {
    const raw = '  @#DGREGORIAN@ 12 JAN 1900 '
    const r = parseEventDate(raw)
    expect(r.originalDateString).toBe(raw)
    expect(r).toMatchObject({ dateKind: 'EXACT', day: 12, month: 1, year: 1900 })
  })

  it('tidak mengarang presisi: hasil ABOUT fallback tidak punya komponen tanggal', () => {
    for (const bad of ['', '   ', 'xxx', 'BET 1 JAN AND 2 JAN 1900']) {
      const r = parseEventDate(bad)
      expect(r.dateKind).toBe('ABOUT')
      expect(r).not.toHaveProperty('day')
      expect(r).not.toHaveProperty('month')
      expect(r).not.toHaveProperty('year')
      expect(r).not.toHaveProperty('from')
      expect(r).not.toHaveProperty('to')
    }
  })
})
