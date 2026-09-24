// Unit test FAMC import capture (STG v159-iii-a): famcStat pada
// ImportedIndividual. Satu entri per FAMC, fam = pointer verbatim tanpa @,
// urai STAT lewat parseFamcStat, INDI tanpa FAMC famcStat kosong.

import { describe, expect, it } from 'vitest'
import { importIndividuals } from './importIndividuals'

/** Bantu: GEDCOM INDI tunggal dengan baris tambahan bebas. */
function indi(lines: string[]): string {
  return [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '0 @I1@ INDI',
    ...lines,
    '0 TRLR',
    '',
  ].join('\n')
}

describe('importIndividuals - FAMC STAT enum valid', () => {
  it('STAT CHALLENGED terbaca pada famcStat', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F1@',
      '2 STAT CHALLENGED',
    ]))
    expect(out).toHaveLength(1)
    expect(out[0]!.famcStat).toHaveLength(1)
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F1')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('CHALLENGED')
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })

  it('STAT DISPROVEN terbaca pada famcStat', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F2@',
      '2 STAT DISPROVEN',
    ]))
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F2')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('DISPROVEN')
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })

  it('STAT PROVEN terbaca pada famcStat', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F3@',
      '2 STAT PROVEN',
    ]))
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F3')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('PROVEN')
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })
})
