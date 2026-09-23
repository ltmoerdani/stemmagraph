// Tests for NO assertion wiring into INDI/FAM import (v137-ii-a).
// Contract: parseNoLines output is passed through verbatim (no extra
// normalization), same discipline as RESN in importFamilies.resn.test.ts.
// Purity: no DB, no env, never throws on invalid payloads.
import { describe, it, expect } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'

function ged(lines: string[]): string {
  return ['0 HEAD', '1 GEDC', '2 VERS 7.0', ...lines, '0 TRLR'].join('\n')
}

describe('no-assertion import wiring (v137-ii-a)', () => {
  it('INDI NO MARR dengan DATE TO diteruskan verbatim', () => {
    const indis = importIndividuals(
      ged(['0 @I1@ INDI', '1 NO MARR', '2 DATE TO 1900']),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].noAssertions).toEqual([
      { event: 'MARR', date: 'TO 1900' },
    ])
  })

  it('INDI NO BURI dengan DATE TO 1900', () => {
    const indis = importIndividuals(
      ged(['0 @I1@ INDI', '1 NO BURI', '2 DATE TO 1900']),
    )
    expect(indis[0].noAssertions).toEqual([
      { event: 'BURI', date: 'TO 1900' },
    ])
  })

  it('multi kejadian dalam satu INDI record, masing-masing benar', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 NO BIRT',
        '1 NO MARR',
        '2 DATE TO 1950',
        '2 NOTE alasan',
      ]),
    )
    expect(indis[0].noAssertions).toEqual([
      { event: 'BIRT' },
      { event: 'MARR', date: 'TO 1950', note: 'alasan' },
    ])
  })

  it('extTag _MYEVENT diterima sebagai payload NO', () => {
    const indis = importIndividuals(ged(['0 @I1@ INDI', '1 NO _MYEVENT']))
    expect(indis[0].noAssertions).toEqual([{ event: '_MYEVENT' }])
  })

  it('payload invalid menghasilkan warning di lapisan parse, BUKAN throw', () => {
    // Warning terstruktur sudah dites di no-assertion.test.ts; di lapisan
    // wiring yang dibuktikan: import tetap sukses, assertion tak terbentuk.
    const indis = importIndividuals(
      ged(['0 @I1@ INDI', '1 NO NOTANEVENT', '1 NAME Budi']),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].noAssertions).toEqual([])
    expect(indis[0].name).toBe('Budi')
  })

  it('FAM NO MARR level record dengan field lain utuh', () => {
    const fams = importFamilies(
      ged([
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 NO MARR',
        '2 DATE TO 1900',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
      ]),
    )
    expect(fams).toHaveLength(1)
    expect(fams[0].husband).toBe('I1')
    expect(fams[0].wife).toBe('I2')
    expect(fams[0].noAssertions).toEqual([
      { event: 'MARR', date: 'TO 1900' },
    ])
  })

  it('record tanpa NO menghasilkan noAssertions kosong yang konsisten', () => {
    const indis = importIndividuals(ged(['0 @I1@ INDI', '1 NAME Budi']))
    const fams = importFamilies(ged(['0 @F1@ FAM']))
    expect(indis[0].noAssertions).toEqual([])
    expect(fams[0].noAssertions).toEqual([])
  })

  it('urutan dua NO dalam satu record terjaga', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 NO DIV',
        '1 NO MARR',
        '2 DATE TO 1900',
      ]),
    )
    expect(indis[0].noAssertions?.map((a) => a.event)).toEqual(['DIV', 'MARR'])
    expect(indis[0].noAssertions?.[1].date).toBe('TO 1900')
  })

  it('round-trip GEDCStruct toString lalu parse lagi: noAssertions konsisten', () => {
    const source = ged([
      '0 @I1@ INDI',
      '1 NO MARR',
      '2 DATE TO 1900',
      '1 NO BURI',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
    ])
    const once = importIndividuals(source)
    // Catatan vendor: xref hanya ditulis ulang saat record dirujuk pointer
    // lain, makanya dokumen ini menyertakan FAM HUSB @I1@.
    const roundTripped = GEDCStruct.fromString(source, g7ConfGEDC).toString(
      '\n',
    )
    const twice = importIndividuals(roundTripped)
    expect(twice).toEqual(once)
    expect(twice[0].noAssertions).toEqual([
      { event: 'MARR', date: 'TO 1900' },
      { event: 'BURI' },
    ])
  })

  it('regresi: INDI tanpa NO identik dengan perilaku lama', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 NAME Budi Santoso',
        '1 SEX M',
        '1 BIRT',
        '2 DATE 12 JAN 1900',
        '2 PLAC Surabaya',
        '1 RESN CONFIDENTIAL',
      ]),
    )
    expect(indis).toHaveLength(1)
    const { noAssertions, ...rest } = indis[0]
    expect(noAssertions).toEqual([])
    expect(rest).toEqual({
      xref: 'I1',
      name: 'Budi Santoso',
      sex: 'M',
      birthDate: {
        dateKind: 'EXACT',
        year: 1900,
        month: 1,
        day: 12,
        originalDateString: '12 JAN 1900',
      },
      birthPlace: 'Surabaya',
      deathDate: undefined,
      deathPlace: undefined,
      resn: 'CONFIDENTIAL',
      citations: [],
    })
  })
})
