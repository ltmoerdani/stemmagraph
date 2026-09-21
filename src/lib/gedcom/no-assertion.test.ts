import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  NO_EVENT_ENUM,
  isNoAssertionEvent,
  parseNoDatePeriod,
  parseNoLines,
} from './no-assertion'

describe('NO_EVENT_ENUM', () => {
  it('tepat 31 nilai enumset-EVEN', () => {
    expect(NO_EVENT_ENUM.size).toBe(31)
  })

  it('mencakup contoh inti MARR BIRT DEAT BURI', () => {
    for (const tag of ['MARR', 'BIRT', 'DEAT', 'BURI']) {
      expect(NO_EVENT_ENUM.has(tag)).toBe(true)
    }
  })
})

describe('isNoAssertionEvent', () => {
  it('enum EVEN diterima', () => {
    expect(isNoAssertionEvent('MARR')).toBe(true)
  })

  it('extTag underscore diterima', () => {
    expect(isNoAssertionEvent('_MYEVENT')).toBe(true)
  })

  it('payload acak ditolak', () => {
    expect(isNoAssertionEvent('NOTE')).toBe(false)
    expect(isNoAssertionEvent('marr')).toBe(false)
  })
})

describe('parseNoDatePeriod', () => {
  it('bentuk TO', () => {
    expect(parseNoDatePeriod('TO 1900')).toEqual({
      kind: 'TO',
      to: '1900',
    })
  })

  it('bentuk FROM-TO', () => {
    expect(parseNoDatePeriod('FROM 1900 TO 1950')).toEqual({
      kind: 'FROM-TO',
      from: '1900',
      to: '1950',
    })
  })

  it('bukan pola DatePeriod mengembalikan null', () => {
    expect(parseNoDatePeriod('ABT 1900')).toBeNull()
    expect(parseNoDatePeriod('')).toBeNull()
  })
})

describe('parseNoLines', () => {
  it('NO MARR dengan DATE TO', () => {
    const result = parseNoLines([
      '1 NO MARR',
      '2 DATE TO 1900',
    ])
    expect(result.warnings).toEqual([])
    expect(result.assertions).toHaveLength(1)
    expect(result.assertions[0].event).toBe('MARR')
    expect(result.assertions[0].date).toBe('TO 1900')
  })

  it('NO BURI dengan DATE TO 1900', () => {
    const result = parseNoLines(['1 NO BURI', '2 DATE TO 1900'])
    expect(result.assertions[0].date).toBe('TO 1900')
  })

  it('NO multi-kejadian dalam satu input', () => {
    const result = parseNoLines([
      '1 NO MARR',
      '1 NO DIV',
    ])
    expect(result.warnings).toEqual([])
    expect(result.assertions).toHaveLength(2)
    expect(result.assertions[0].event).toBe('MARR')
    expect(result.assertions[1].event).toBe('DIV')
  })

  it('payload extTag custom diterima tanpa warning', () => {
    const result = parseNoLines(['1 NO _MYEVENT'])
    expect(result.warnings).toEqual([])
    expect(result.assertions[0].event).toBe('_MYEVENT')
  })

  it('payload tidak valid menghasilkan warning bukan throw', () => {
    const result = parseNoLines(['1 NO BLAG'])
    expect(result.assertions).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].line).toBe(1)
  })

  it('FROM-TO round trip pola lengkap', () => {
    const result = parseNoLines([
      '1 NO MARR',
      '2 DATE FROM 1900 TO 1950',
      '2 SNOTE tidak pernah menikah',
    ])
    expect(result.assertions[0].date).toBe('FROM 1900 TO 1950')
    expect(result.assertions[0].note).toBe('tidak pernah menikah')
    expect(result.warnings).toEqual([])
  })

  it('baris non-NO menutup assertion terbuka (sub-line tak menempel lagi), assertion valid tetap tersimpan', () => {
    const result = parseNoLines([
      '1 NO MARR',
      '1 SEX M',
      '1 NO DIV',
      '2 DATE TO 1900',
    ])
    expect(result.assertions).toHaveLength(2)
    expect(result.assertions[0].event).toBe('MARR')
    expect(result.assertions[0].date).toBeUndefined()
    expect(result.assertions[1].event).toBe('DIV')
    expect(result.assertions[1].date).toBe('TO 1900')
  })

  it('PHRASE dilampirkan ke assertion terbuka', () => {
    const result = parseNoLines([
      '1 NO DEAT',
      '2 DATE TO 1950',
      '3 PHRASE sebelum pindah',
    ])
    expect(result.assertions[0].phrase).toBe('sebelum pindah')
  })
})