// Testfile dedikasi displayEventDate (v271 fase i).
//
// Murni deterministik: tanpa jam sistem, tanpa Date, tanpa timer.
// Input dibangun lewat parseEventDate sesuai alur pemakaian nyata
// (parser -> display), cakupan:
//   - 4 kind (EXACT/ABOUT/BEFORE/AFTER) x 2 locale (id/en)
//   - presisi tahun saja, bulan+tahun, hari+bulan+tahun terjaga per kind
//   - locale tak dikenal fallback 'en'
//   - RANGE kembali null (di luar scope fase i)
//   - komponen tidak sah / dateKind tak dikenal kembali null
//   - determinisme murni: hasil identik antar pemanggilan

import { describe, expect, it } from 'vitest'

import { parseEventDate } from './parseEventDate'
import { displayEventDate } from './eventDateDisplay'

describe('displayEventDate: EXACT tanpa prefix, presisi terjaga', () => {
  it('id: hari bulan tahun tanpa prefix', () => {
    expect(displayEventDate(parseEventDate('12 MAR 1945'), 'id')).toBe('12 MAR 1945')
  })

  it('en: hari bulan tahun tanpa prefix', () => {
    expect(displayEventDate(parseEventDate('12 MAR 1945'), 'en')).toBe('12 MAR 1945')
  })

  it('id: bulan tahun tanpa prefix', () => {
    expect(displayEventDate(parseEventDate('MAR 1945'), 'id')).toBe('MAR 1945')
  })

  it('en: tahun saja tanpa prefix', () => {
    expect(displayEventDate(parseEventDate('1945'), 'en')).toBe('1945')
  })
})

describe('displayEventDate: ABOUT prefix per locale', () => {
  it('id: sekitar + tahun saja', () => {
    expect(displayEventDate(parseEventDate('ABT 1900'), 'id')).toBe('sekitar 1900')
  })

  it('en: about + hari bulan tahun', () => {
    expect(displayEventDate(parseEventDate('ABT 12 MAR 1945'), 'en')).toBe('about 12 MAR 1945')
  })

  it('id: sekitar + bulan tahun dari input ABOUT panjang', () => {
    expect(displayEventDate(parseEventDate('ABOUT 1945-03'), 'id')).toBe('sekitar MAR 1945')
  })
})

describe('displayEventDate: BEFORE prefix per locale', () => {
  it('id: sebelum + tahun saja', () => {
    expect(displayEventDate(parseEventDate('BEF 1910'), 'id')).toBe('sebelum 1910')
  })

  it('en: before + hari bulan tahun', () => {
    expect(displayEventDate(parseEventDate('BEFORE 12 MAR 1945'), 'en')).toBe('before 12 MAR 1945')
  })
})

describe('displayEventDate: AFTER prefix per locale', () => {
  it('id: sesudah + tahun saja', () => {
    expect(displayEventDate(parseEventDate('AFT 1888'), 'id')).toBe('sesudah 1888')
  })

  it('en: after + bulan tahun', () => {
    expect(displayEventDate(parseEventDate('AFT JUN 1901'), 'en')).toBe('after JUN 1901')
  })
})

describe('displayEventDate: locale tak dikenal fallback en', () => {
  it("locale 'es' tak dikenal fallback en", () => {
    expect(displayEventDate(parseEventDate('ABT 1900'), 'es' as 'id' | 'en')).toBe('about 1900')
  })

  it("locale string kosong tak dikenal fallback en", () => {
    expect(displayEventDate(parseEventDate('BEF 1910'), '' as 'id' | 'en')).toBe('before 1910')
  })
})

describe('displayEventDate: RANGE null per kontrak string | null', () => {
  it('id: RANGE kembali null', () => {
    expect(displayEventDate(parseEventDate('BET 1900 AND 1910'), 'id')).toBeNull()
  })

  it('en: RANGE kembali null', () => {
    expect(displayEventDate(parseEventDate('BET 12 MAR 1945 AND 20 DEC 1950'), 'en')).toBeNull()
  })
})

describe('displayEventDate: null untuk input tak sah, determinisme murni', () => {
  it('ABOUT tanpa komponen (hasil gagal urai parser) kembali null', () => {
    expect(displayEventDate(parseEventDate('BET x AND y'), 'id')).toBeNull()
  })

  it('dateKind tak dikenal kembali null', () => {
    const asing = { dateKind: 'MYSTERY', year: 1900 } as unknown as Parameters<
      typeof displayEventDate
    >[0]
    expect(displayEventDate(asing, 'en')).toBeNull()
  })

  it('input null kembali null tanpa melempar', () => {
    expect(displayEventDate(null as unknown as Parameters<typeof displayEventDate>[0], 'id')).toBeNull()
  })

  it('determinisme: dua pemanggilan identik, tanpa jam sistem', () => {
    const parsed = parseEventDate('ABT 12 MAR 1945')
    expect(displayEventDate(parsed, 'id')).toBe(displayEventDate(parsed, 'id'))
    expect(displayEventDate(parsed, 'id')).toBe('sekitar 12 MAR 1945')
  })
})
