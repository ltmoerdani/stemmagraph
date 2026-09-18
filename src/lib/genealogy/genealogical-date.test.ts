import { describe, it, expect } from 'vitest'
import {
  parseGenealogicalDate,
  toGedcomDateValue,
  formatHuman,
  roundTrip,
  normalizeQuality,
} from './genealogical-date'

describe('parseGenealogicalDate: tanggal eksak', () => {
  it('tahun tunggal menjadi modifier exact', () => {
    expect(parseGenealogicalDate('1900')).toEqual({ modifier: 'exact', year: 1900, quality: null })
  })

  it('input kosong atau null menghasilkan null', () => {
    expect(parseGenealogicalDate(null)).toBeNull()
    expect(parseGenealogicalDate(undefined)).toBeNull()
    expect(parseGenealogicalDate('   ')).toBeNull()
  })
})

describe('FROM-TO (periode) vs BET-AND (rentang): dua semantik berbeda', () => {
  it('FROM 1900 TO 1910 menghasilkan modifier from dengan dua ujung', () => {
    expect(parseGenealogicalDate('FROM 1900 TO 1910')).toEqual({
      modifier: 'from', year: 1900, year2: 1910, quality: null,
    })
  })

  it('BET 1900 AND 1910 menghasilkan modifier range dengan dua ujung', () => {
    expect(parseGenealogicalDate('BET 1900 AND 1910')).toEqual({
      modifier: 'range', year: 1900, year2: 1910, quality: null,
    })
  })

  it('kedua semantik tidak tertukar meski ujungnya sama', () => {
    const period = parseGenealogicalDate('FROM 1900 TO 1910')
    const search = parseGenealogicalDate('BET 1900 AND 1910')
    expect(period?.modifier).toBe('from')
    expect(search?.modifier).toBe('range')
    expect(toGedcomDateValue(period!)).toBe('FROM 1900 TO 1910')
    expect(toGedcomDateValue(search!)).toBe('BET 1900 AND 1910')
  })

  it('AFTER dan BEFORE memetakan ke ujung tunggal from/to', () => {
    expect(parseGenealogicalDate('AFTER 1900')).toEqual({ modifier: 'from', year: 1900, quality: null })
    expect(parseGenealogicalDate('BEFORE 1950')).toEqual({ modifier: 'to', year: 1950, quality: null })
  })
})

describe('modifier ABT/CAL/EST: tepat tiga kata', () => {
  it('ABT 1900 menjadi about', () => {
    expect(parseGenealogicalDate('ABT 1900')).toEqual({ modifier: 'about', year: 1900, quality: null })
  })

  it('CAL 1875 menjadi calculated', () => {
    expect(parseGenealogicalDate('CAL 1875')).toEqual({ modifier: 'calculated', year: 1875, quality: null })
  })

  it('EST 1850 menjadi estimated', () => {
    expect(parseGenealogicalDate('EST 1850')).toEqual({ modifier: 'estimated', year: 1850, quality: null })
  })

  it('kata approx dengan dua kata atau empat kata jatuh ke phrase, bukan modifier', () => {
    expect(parseGenealogicalDate('ABT ABCD')?.phrase).toBe('ABT ABCD')
    expect(parseGenealogicalDate('ABT 1900 1910')?.phrase).toBe('ABT 1900 1910')
    expect(parseGenealogicalDate('ABT 1900 1910')?.modifier).toBe('exact')
  })
})

describe('quality sebagai sumbu terpisah dari modifier', () => {
  it('hasil parse default quality null tanpa metadata sumber', () => {
    expect(parseGenealogicalDate('1900')?.quality).toBeNull()
  })

  it('normalizeQuality memetakan tiga nilai quality', () => {
    expect(normalizeQuality('PRIMARY')).toBe('primary')
    expect(normalizeQuality('secondary')).toBe('secondary')
    expect(normalizeQuality('Tertiary')).toBe('tertiary')
  })

  it('normalizeQuality mengembalikan null untuk input tak dinyatakan atau tak dikenal', () => {
    expect(normalizeQuality(undefined)).toBeNull()
    expect(normalizeQuality('bogus')).toBeNull()
  })

  it('quality bisa dilekatkan pada tanggal dengan modifier apa pun tanpa mengubah modifier', () => {
    const dated = { ...parseGenealogicalDate('ABT 1900')!, quality: 'secondary' as const }
    expect(dated.modifier).toBe('about')
    expect(dated.quality).toBe('secondary')
    expect(formatHuman(dated)).toBe('sekitar 1900 [secondary]')
  })
})

describe('phrase asli tersimpan utuh', () => {
  it('teks bebas menjadi exact dengan phrase tanpa dipotong', () => {
    expect(parseGenealogicalDate('musim panen 1870-an')).toEqual({
      modifier: 'exact', phrase: 'musim panen 1870-an', quality: null,
    })
  })

  it('serialisasi phrase dibungkus kurung agar utuh sebagai satu value', () => {
    const parsed = parseGenealogicalDate('musim panen 1870-an')
    expect(toGedcomDateValue(parsed!)).toBe('(musim panen 1870-an)')
  })
})

describe('roundTrip identitas untuk semua kelas tanggal terstruktur', () => {
  const inputs = ['1900', 'FROM 1900 TO 1910', 'BET 1900 AND 1910', 'ABT 1900', 'CAL 1875', 'EST 1850']

  it.each(inputs)('roundTrip(%s) setara parse langsung', (input) => {
    expect(roundTrip(input)).toEqual(parseGenealogicalDate(input))
  })
})

describe('toGedcomDateValue: output valid GEDCOM 7', () => {
  it('menghasilkan value DATE GEDCOM 7 yang dikenali', () => {
    expect(toGedcomDateValue(parseGenealogicalDate('1900')!)).toBe('1900')
    expect(toGedcomDateValue(parseGenealogicalDate('FROM 1900 TO 1910')!)).toBe('FROM 1900 TO 1910')
    expect(toGedcomDateValue(parseGenealogicalDate('BET 1900 AND 1910')!)).toBe('BET 1900 AND 1910')
    expect(toGedcomDateValue(parseGenealogicalDate('ABT 1900')!)).toBe('ABT 1900')
    expect(toGedcomDateValue(parseGenealogicalDate('BEFORE 1950')!)).toBe('TO 1950')
  })

  it('formatHuman merangkum tanggal untuk UI', () => {
    expect(formatHuman(parseGenealogicalDate('1900')!)).toBe('1900')
    expect(formatHuman(parseGenealogicalDate('FROM 1900 TO 1910')!)).toBe('sejak 1900 hingga 1910')
  })
})
