// Unit test formatter tanggal GEDCOM 7 (S1F4-A).
//
// Fokus: formatGedcomDateValue memetakan setiap dateKind hasil
// parseEventDate ke payload DateValue GEDCOM 7 dengan presisi yang
// dipertahankan persis (tahun saja tetap tahun saja, bulan+tahun tanpa
// hari, rentang menjaga presisi tiap sisi), dan kembali null untuk
// hasil parser yang tidak mewakili tanggal sah (fallback raw di lapisan
// export). Kasus dibangun lewat parseEventDate agar kontrak nyata
// parser -> formatter teruji, bukan objek hasil rekayasa.

import { describe, expect, it } from 'vitest'
import { parseEventDate } from './parseEventDate'
import { formatGedcomDateValue } from './formatGedcomDate'

describe('formatGedcomDateValue: EXACT menjaga presisi', () => {
  it('hari+bulan+tahun GEDCOM ditulis apa adanya', () => {
    expect(formatGedcomDateValue(parseEventDate('12 MAR 1945'))).toBe('12 MAR 1945')
  })

  it('ISO 8601 hari penuh dipetakan ke bulan GEDCOM', () => {
    expect(formatGedcomDateValue(parseEventDate('1945-03-12'))).toBe('12 MAR 1945')
  })

  it('bulan+tahun tanpa hari tetap tanpa hari (jangan mengarang hari)', () => {
    expect(formatGedcomDateValue(parseEventDate('MAR 1945'))).toBe('MAR 1945')
  })

  it('ISO 8601 bulan+tahun dipetakan ke bulan GEDCOM tanpa hari', () => {
    expect(formatGedcomDateValue(parseEventDate('1945-03'))).toBe('MAR 1945')
  })

  it('tahun saja tetap tahun saja', () => {
    expect(formatGedcomDateValue(parseEventDate('1945'))).toBe('1945')
  })
})

describe('formatGedcomDateValue: kata kunci presisi longgar', () => {
  it('ABT tahun saja menghasilkan "ABT 1945"', () => {
    expect(formatGedcomDateValue(parseEventDate('ABT 1945'))).toBe('ABT 1945')
  })

  it('ABOUT (bentuk panjang) dengan hari penuh dinormalisasi ke prefiks ABT', () => {
    expect(formatGedcomDateValue(parseEventDate('ABOUT 12 MAR 1945'))).toBe('ABT 12 MAR 1945')
  })

  it('ABT bulan+tahun menjaga presisi bulan tanpa hari', () => {
    expect(formatGedcomDateValue(parseEventDate('ABT 1945-03'))).toBe('ABT MAR 1945')
  })

  it('BEF bulan+tahun menghasilkan prefiks BEF', () => {
    expect(formatGedcomDateValue(parseEventDate('BEFORE MAR 1900'))).toBe('BEF MAR 1900')
  })

  it('AFT hari penuh menghasilkan prefiks AFT', () => {
    expect(formatGedcomDateValue(parseEventDate('AFT 12 JAN 1900'))).toBe('AFT 12 JAN 1900')
  })
})

describe('formatGedcomDateValue: RANGE', () => {
  it('BET..AND presisi sama di kedua sisi', () => {
    expect(formatGedcomDateValue(parseEventDate('BET 1900 AND 1910'))).toBe('BET 1900 AND 1910')
  })

  it('BET..AND presisi campur: tiap sisi dijaga masing-masing', () => {
    expect(
      formatGedcomDateValue(parseEventDate('BET 12 MAR 1945 AND JUN 1950')),
    ).toBe('BET 12 MAR 1945 AND JUN 1950')
  })

  it('BET..AND dengan sisi ISO gagal urai parser sehingga kembali null', () => {
    // Parser RANGE hanya menerima tanggal GEDCOM; sisi ISO membuat
    // hasil jatuh ke ABOUT tanpa komponen, dan formatter menolaknya.
    expect(formatGedcomDateValue(parseEventDate('BET 1945-03-12 AND 1950'))).toBeNull()
  })
})

describe('formatGedcomDateValue: tidak sah -> null', () => {
  it('teks tak terurai (hasil ABOUT tanpa komponen) kembali null', () => {
    expect(formatGedcomDateValue(parseEventDate('kira-kira 1945'))).toBeNull()
  })

  it('string kosong kembali null', () => {
    expect(formatGedcomDateValue(parseEventDate(''))).toBeNull()
  })

  it('input null pada runtime kembali null, tanpa melempar', () => {
    expect(formatGedcomDateValue(null as unknown as Parameters<typeof formatGedcomDateValue>[0])).toBeNull()
  })

  it('huruf kecil dinormalisasi parser menjadi bulan kapital', () => {
    expect(formatGedcomDateValue(parseEventDate('abt 3 jun 2001'))).toBe('ABT 3 JUN 2001')
  })
})
