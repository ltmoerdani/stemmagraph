import { describe, expect, it } from 'vitest'
import { parseTextDate } from './textdate-parser'

describe('parseTextDate: tahun tunggal', () => {
  it("'1945' = exact year 1945", () => {
    expect(parseTextDate('1945')).toEqual({ modifier: 'exact', year: 1945 })
  })

  it("'1850' = exact year 1850", () => {
    expect(parseTextDate('1850')).toEqual({ modifier: 'exact', year: 1850 })
  })
})

describe('parseTextDate: tanggal GEDCOM-style', () => {
  it("'12 MAR 1945' = exact year + phrase asli", () => {
    const r = parseTextDate('12 MAR 1945')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('exact')
    expect(r?.year).toBe(1945)
    expect(r?.phrase).toBe('12 MAR 1945')
  })

  it("'mar 1945' huruf kecil = exact year + phrase asli", () => {
    const r = parseTextDate('mar 1945')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('exact')
    expect(r?.year).toBe(1945)
    expect(r?.phrase).toBe('mar 1945')
  })
})

describe('parseTextDate: approx prefix', () => {
  it("'ABT 1945' = about year 1945", () => {
    expect(parseTextDate('ABT 1945')).toEqual({ modifier: 'about', year: 1945 })
  })

  it("'EST 1930' = estimated year 1930", () => {
    expect(parseTextDate('EST 1930')).toEqual({
      modifier: 'estimated',
      year: 1930,
    })
  })

  it("'CAL 1901' = calculated year 1901", () => {
    expect(parseTextDate('CAL 1901')).toEqual({
      modifier: 'calculated',
      year: 1901,
    })
  })
})

describe('parseTextDate: batas atas dan bawah', () => {
  it("'BEF 1945' = to, BUKAN exact", () => {
    const r = parseTextDate('BEF 1945')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('to')
    expect(r?.year).toBe(1945)
    expect(r?.modifier).not.toBe('exact')
  })

  it("'AFT 1900' = from", () => {
    expect(parseTextDate('AFT 1900')).toEqual({ modifier: 'from', year: 1900 })
  })
})

describe('parseTextDate: rentang dan periode', () => {
  it("'BET 1940 AND 1945' = range year year2", () => {
    expect(parseTextDate('BET 1940 AND 1945')).toEqual({
      modifier: 'range',
      year: 1940,
      year2: 1945,
    })
  })

  it("'FROM 1940 TO 1945' = from year + year2", () => {
    expect(parseTextDate('FROM 1940 TO 1945')).toEqual({
      modifier: 'from',
      year: 1940,
      year2: 1945,
    })
  })
})

describe('parseTextDate: kejujuran presisi (ADR 0011)', () => {
  it("'sekitar zaman jepang' tak terurai = about + phrase, TANPA year palsu", () => {
    const r = parseTextDate('sekitar zaman jepang')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('about')
    expect(r?.phrase).toBe('sekitar zaman jepang')
    expect(r?.year).toBeUndefined()
  })

  it("'ABT MAR 1945' menghasilkan about dengan phrase asli (bulan tak terurai penuh)", () => {
    const r = parseTextDate('ABT MAR 1945')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('about')
    expect(r?.phrase).toBe('ABT MAR 1945')
  })

  it("'pasca kemerdekaan' tak terurai = about + phrase utuh", () => {
    const r = parseTextDate('pasca kemerdekaan')
    expect(r).not.toBeNull()
    expect(r?.modifier).toBe('about')
    expect(r?.phrase).toBe('pasca kemerdekaan')
    expect(r?.year).toBeUndefined()
  })
})

describe('parseTextDate: null dan determinisme', () => {
  it("string kosong = null", () => {
    expect(parseTextDate('')).toBeNull()
  })

  it("whitespace saja = null", () => {
    expect(parseTextDate('   ')).toBeNull()
  })

  it('deterministik: dua panggilan hasil identik', () => {
    const a = parseTextDate('BET 1940 AND 1945')
    const b = parseTextDate('BET 1940 AND 1945')
    expect(a).toEqual(b)
    expect(parseTextDate('1945')).toEqual(parseTextDate('1945'))
  })
})
