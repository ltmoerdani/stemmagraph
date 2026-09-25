// Unit test FAMC import capture (STG v159-iii-a): famcStat pada
// ImportedIndividual. Satu entri per FAMC berpointer, fam = xref record FAM
// target tanpa @, urai STAT lewat parseFamcStat, INDI tanpa FAMC famcStat
// kosong, round-trip byte-identical lewat lapisan vendor.

import { describe, expect, it } from 'vitest'
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import { importIndividuals } from './importIndividuals'

/**
 * Bantu: GEDCOM dengan INDI @I1@ berisi baris bebas. Setiap xref di fams
 * menghasilkan record FAM target ber-CHIL @I1@ agar pointer FAMC resolve.
 */
function indi(lines: string[], fams: string[] = ['F1']): string {
  return [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '0 @I1@ INDI',
    ...lines,
    ...fams.flatMap((f) => [`0 @${f}@ FAM`, '1 CHIL @I1@']),
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
    ], ['F2']))
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F2')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('DISPROVEN')
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })

  it('STAT PROVEN terbaca pada famcStat', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F3@',
      '2 STAT PROVEN',
    ], ['F3']))
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F3')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('PROVEN')
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })
})

describe('importIndividuals - STAT tidak valid', () => {
  it('STAT tak dikenal: value nihil, payload tercatat verbatim di warning', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F1@',
      '2 STAT MAYBE',
    ]))
    expect(out[0]!.famcStat).toHaveLength(1)
    expect(out[0]!.famcStat?.[0]?.stat.value).toBeUndefined()
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toHaveLength(1)
    expect(out[0]!.famcStat?.[0]?.stat.warnings[0]?.warning).toBe('invalid-stat')
    expect(out[0]!.famcStat?.[0]?.stat.warnings[0]?.raw).toBe('MAYBE')
  })

  it('STAT dengan teks bebas: raw warning menyalin payload apa adanya', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F1@',
      '2 STAT katanya sih iya',
    ]))
    expect(out[0]!.famcStat?.[0]?.stat.value).toBeUndefined()
    expect(out[0]!.famcStat?.[0]?.stat.warnings[0]?.raw).toBe('katanya sih iya')
  })
})

describe('importIndividuals - banyak FAMC dan kasus nihil', () => {
  it('dua FAMC pada satu INDI menghasilkan dua entri urut dokumen', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F1@',
      '2 STAT PROVEN',
      '1 FAMC @F2@',
      '2 STAT CHALLENGED',
    ], ['F1', 'F2']))
    expect(out[0]!.famcStat).toHaveLength(2)
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F1')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBe('PROVEN')
    expect(out[0]!.famcStat?.[1]?.fam).toBe('F2')
    expect(out[0]!.famcStat?.[1]?.stat.value).toBe('CHALLENGED')
  })

  it('FAMC tanpa STAT: entri tetap ada, value nihil tanpa warning', () => {
    const out = importIndividuals(indi(['1 FAMC @F1@']))
    expect(out[0]!.famcStat).toHaveLength(1)
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F1')
    expect(out[0]!.famcStat?.[0]?.stat.value).toBeUndefined()
    expect(out[0]!.famcStat?.[0]?.stat.warnings).toEqual([])
  })

  it('INDI tanpa FAMC: properti famcStat absent (bentuk lama terjaga)', () => {
    const out = importIndividuals(indi(['1 NAME Budi /Santoso/'], []))
    expect(out[0]!.famcStat).toBeUndefined()
  })

  it('pointer FAMC tercatat benar tanpa tanda @', () => {
    const out = importIndividuals(indi([
      '1 FAMC @F12345@',
      '2 STAT DISPROVEN',
    ], ['F12345']))
    expect(out[0]!.famcStat?.[0]?.fam).toBe('F12345')
  })
})

describe('importIndividuals - round-trip dan komposisi existing', () => {
  it('round-trip byte-identical: FAMC dengan STAT utuh lewat lapisan vendor', () => {
    const src = indi([
      '1 NAME Anak /Kandung/',
      '1 SEX M',
      '1 FAMC @F1@',
      '2 STAT PROVEN',
    ])
    const records = GEDCStruct.fromString(src, g7ConfGEDC)
    expect(records.toString()).toBe(src)
  })

  it('komposisi output existing tetap sama pada INDI tanpa FAMC', () => {
    const out = importIndividuals(indi([
      '1 NAME Budi /Santoso/',
      '1 SEX M',
      '1 BIRT',
      '2 DATE 12 JAN 1900',
      '2 PLAC Surabaya',
      '1 RESN PRIVACY',
    ], []))
    expect(out).toHaveLength(1)
    const p = out[0]!
    expect(p.xref).toBe('I1')
    expect(p.name).toBe('Budi /Santoso/')
    expect(p.sex).toBe('M')
    expect(p.birthDate?.dateKind).toBe('EXACT')
    expect(p.birthPlace).toBe('Surabaya')
    expect(p.deathDate).toBeUndefined()
    expect(p.deathPlace).toBeUndefined()
    expect(p.resn).toBe('PRIVACY')
    expect(p.noAssertions).toEqual([])
    expect(p.citations).toEqual([])
    expect(p.famcStat).toBeUndefined()
  })
})
