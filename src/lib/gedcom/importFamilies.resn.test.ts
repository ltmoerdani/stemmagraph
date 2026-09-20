// Tests for RESN parsing in FAM import (v131-i): RESN must come through
// verbatim (no trim-as-enum normalization, no mapping), exactly like the
// INDI path in importIndividuals.ts. Purity: no DB, no env.
import { describe, it, expect } from 'vitest'
import { importFamilies } from './importFamilies'

function ged(lines: string[]): string {
  return ['0 HEAD', '1 GEDC', '2 VERS 7.0', ...lines, '0 TRLR'].join('\n')
}

describe('importFamilies RESN verbatim (v131-i)', () => {
  it('FAM tanpa RESN menghasilkan resn undefined', () => {
    const fams = importFamilies(ged(['0 @F1@ FAM']))
    expect(fams).toHaveLength(1)
    expect(fams[0].resn).toBeUndefined()
  })

  it('RESN tunggal CONFIDENTIAL', () => {
    const fams = importFamilies(ged(['0 @F1@ FAM', '1 RESN CONFIDENTIAL']))
    expect(fams[0].resn).toBe('CONFIDENTIAL')
  })

  it('multi-nilai dengan spasi: verbatim utuh', () => {
    const fams = importFamilies(
      ged(['0 @F1@ FAM', '1 RESN CONFIDENTIAL, LOCKED']),
    )
    expect(fams[0].resn).toBe('CONFIDENTIAL, LOCKED')
  })

  it('multi-nilai tanpa spasi: verbatim utuh', () => {
    const fams = importFamilies(
      ged(['0 @F1@ FAM', '1 RESN CONFIDENTIAL,LOCKED']),
    )
    expect(fams[0].resn).toBe('CONFIDENTIAL,LOCKED')
  })

  it('dua FAM dengan RESN berbeda masing-masing benar', () => {
    const fams = importFamilies(
      ged([
        '0 @F1@ FAM',
        '1 RESN CONFIDENTIAL',
        '0 @F2@ FAM',
        '1 RESN LOCKED',
      ]),
    )
    expect(fams).toHaveLength(2)
    expect(fams[0].resn).toBe('CONFIDENTIAL')
    expect(fams[1].resn).toBe('LOCKED')
  })

  it('FAM lengkap HUSB WIFE CHIL plus RESN: topology tetap benar', () => {
    const fams = importFamilies(
      ged([
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '1 RESN CONFIDENTIAL, LOCKED',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        '0 @I3@ INDI',
      ]),
    )
    expect(fams).toHaveLength(1)
    const f = fams[0]
    expect(f.xref).toBe('F1')
    expect(f.husband).toBe('I1')
    expect(f.wife).toBe('I2')
    expect(f.children).toEqual(['I3'])
    expect(f.resn).toBe('CONFIDENTIAL, LOCKED')
  })

  it('nilai tak dikenal tetap verbatim tanpa error', () => {
    const fams = importFamilies(ged(['0 @F1@ FAM', '1 RESN WEIRD-VALUE 42']))
    expect(fams[0].resn).toBe('WEIRD-VALUE 42')
  })

  it('RESN tidak mengubah field lain ImportedFamily', () => {
    const withResn = importFamilies(
      ged(['0 @F1@ FAM', '1 RESN CONFIDENTIAL', '1 MARR', '2 DATE 10 JAN 1900']),
    )
    const withoutResn = importFamilies(
      ged(['0 @F1@ FAM', '1 MARR', '2 DATE 10 JAN 1900']),
    )
    const strip = (r: (typeof withResn)[number]) => {
      const rest = { ...r }
      delete rest.resn
      return rest
    }
    expect(strip(withResn[0])).toEqual(strip(withoutResn[0]))
    expect(withResn[0].resn).toBe('CONFIDENTIAL')
    expect(withoutResn[0].resn).toBeUndefined()
  })
})
