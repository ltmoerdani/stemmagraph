// Unit test relationship-enum (v159 fase ii): resolusi enum GEDCOM 7
// level string, case-sensitive tanpa normalisasi, nilai tak dikenal
// menghasilkan phrase raw utuh, phrase berawalan underscore tidak
// diproses khusus, raw selalu utuh, dan hasil deterministik.

import { describe, expect, it } from 'vitest'
import {
  ADOP_VALUES,
  FAMC_STAT_VALUES,
  PEDI_VALUES,
  resolveAdop,
  resolveFamcStat,
  resolvePedi,
} from './relationship-enum'

describe('resolveFamcStat - enum valid', () => {
  it.each(FAMC_STAT_VALUES)('kenali nilai valid %s', (v) => {
    const res = resolveFamcStat(v)
    expect(res.known).toBe(true)
    expect(res.value).toBe(v)
    expect(res.phrase).toBeNull()
    expect(res.raw).toBe(v)
  })
})

describe('resolvePedi - enum valid', () => {
  it.each(PEDI_VALUES)('kenali nilai valid %s', (v) => {
    const res = resolvePedi(v)
    expect(res.known).toBe(true)
    expect(res.value).toBe(v)
    expect(res.phrase).toBeNull()
    expect(res.raw).toBe(v)
  })
})

describe('resolveAdop - enum valid', () => {
  it.each(ADOP_VALUES)('kenali nilai valid %s', (v) => {
    const res = resolveAdop(v)
    expect(res.known).toBe(true)
    expect(res.value).toBe(v)
    expect(res.phrase).toBeNull()
    expect(res.raw).toBe(v)
  })
})

describe('nilai tak dikenal', () => {
  it('FOO di luar enum: known false, value null, phrase utuh', () => {
    const res = resolveFamcStat('FOO')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('FOO')
    expect(res.raw).toBe('FOO')
  })

  it('FOO pada PEDI dan ADOP berlaku sama', () => {
    for (const res of [resolvePedi('FOO'), resolveAdop('FOO')]) {
      expect(res.known).toBe(false)
      expect(res.value).toBeNull()
      expect(res.phrase).toBe('FOO')
      expect(res.raw).toBe('FOO')
    }
  })

  it('phrase berawalan underscore tidak diproses khusus: _kira-kira', () => {
    const res = resolveFamcStat('_kira-kira')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('_kira-kira')
    expect(res.raw).toBe('_kira-kira')
  })

  it('phrase berawalan underscore tidak diproses khusus: _dianggap', () => {
    const res = resolvePedi('_dianggap')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('_dianggap')
    expect(res.raw).toBe('_dianggap')
  })
})

describe('case-sensitivity dan bentuk raw', () => {
  it('proven lowercase tidak sama dengan PROVEN: known false', () => {
    const res = resolveFamcStat('proven')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('proven')
    expect(res.raw).toBe('proven')
  })

  it('birth lowercase tidak diterima pada PEDI', () => {
    const res = resolvePedi('birth')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('birth')
  })

  it('string kosong: known false, phrase dan raw kosong', () => {
    const res = resolveFamcStat('')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('')
    expect(res.raw).toBe('')
  })

  it('whitespace tepi dipertahankan apa adanya di raw tanpa trim', () => {
    const res = resolveFamcStat('  PROVEN  ')
    expect(res.known).toBe(false)
    expect(res.value).toBeNull()
    expect(res.phrase).toBe('  PROVEN  ')
    expect(res.raw).toBe('  PROVEN  ')
  })

  it('nilai valid tidak diubah: raw persis sama dengan input', () => {
    const res = resolveAdop('BOTH')
    expect(res.raw).toBe('BOTH')
    expect(res.value).toBe('BOTH')
  })
})

describe('determinisme', () => {
  it('panggilan dua kali menghasilkan objek identik (toEqual)', () => {
    for (const resolve of [resolveFamcStat, resolvePedi, resolveAdop]) {
      expect(resolve('FOO')).toEqual(resolve('FOO'))
      expect(resolve('PROVEN')).toEqual(resolve('PROVEN'))
      expect(resolve('  PROVEN ')).toEqual(resolve('  PROVEN '))
    }
  })
})
