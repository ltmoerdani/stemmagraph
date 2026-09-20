// Unit test famcStat (STG v125 fase i): 3 enum valid, nilai invalid diabaikan
// plus warning, STAT ganda pakai yang pertama plus warning, FAMC tanpa STAT
// nihil output, round-trip utuh pasangan parse-serialize, fixture inline ala
// maximal70 (FAMC dengan STAT PROVEN).

import { describe, expect, it } from 'vitest'
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import {
  parseFamcStat,
  serializeFamcStat,
  serializeFamcStatStruct,
  type FamcStatValue,
} from './famcStat'

/** Bantu: urai teks GEDCOM dan ambil FAMC pertama dari INDI pertama. */
function firstFamc(gedcom: string): GEDCStruct | undefined {
  const records = GEDCStruct.fromString(gedcom, g7ConfGEDC)
  const indi = records.find((r) => r.tag === 'INDI')
  return indi?.sub.find((s) => s.tag === 'FAMC')
}

/** Bantu: struct FAMC minimal tanpa STAT, digantung di INDI-HEAD. */
function famcOnly(): GEDCStruct {
  const head = new GEDCStruct('HEAD', undefined)
  const indi = new GEDCStruct('INDI', head)
  return new GEDCStruct('FAMC', indi, undefined, '@F1@')
}

/** Bantu: tambah STAT berpayload string ke struct FAMC. */
function addStat(famc: GEDCStruct, payload: string): void {
  new GEDCStruct('STAT', famc, undefined, payload)
}

describe('parseFamcStat - enum valid', () => {
  it('terima CHALLENGED', () => {
    const famc = famcOnly()
    addStat(famc, 'CHALLENGED')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('CHALLENGED')
    expect(res.warnings).toEqual([])
  })

  it('terima DISPROVEN', () => {
    const famc = famcOnly()
    addStat(famc, 'DISPROVEN')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('DISPROVEN')
    expect(res.warnings).toEqual([])
  })

  it('terima PROVEN', () => {
    const famc = famcOnly()
    addStat(famc, 'PROVEN')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('PROVEN')
    expect(res.warnings).toEqual([])
  })

  it('payload dengan spasi tepi diterima setelah trim', () => {
    const famc = famcOnly()
    addStat(famc, '  PROVEN  ')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('PROVEN')
    expect(res.warnings).toEqual([])
  })
})

describe('parseFamcStat - nilai invalid diabaikan', () => {
  it('nilai di luar enum diabaikan: nihil plus warning invalid-stat', () => {
    const famc = famcOnly()
    addStat(famc, 'MAYBE')
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0]?.warning).toBe('invalid-stat')
    expect(res.warnings[0]?.raw).toBe('MAYBE')
  })

  it('nilai mirip enum tidak pernah dipetakan ke status relasi lain', () => {
    const famc = famcOnly()
    addStat(famc, 'PROVENN')
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
  })

  it('payload bukan string (undefined/null) diabaikan sebagai invalid', () => {
    const famc = famcOnly()
    const stat = new GEDCStruct('STAT', famc)
    expect(stat.payload == null).toBe(true)
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings[0]?.warning).toBe('invalid-stat')
  })

  it('string kosong diabaikan sebagai invalid', () => {
    const famc = famcOnly()
    addStat(famc, '')
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings[0]?.warning).toBe('invalid-stat')
  })

  it('nilai lowercase bukan enum (case-sensitive) diabaikan dengan warning', () => {
    const famc = famcOnly()
    addStat(famc, 'proven')
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings[0]?.warning).toBe('invalid-stat')
  })
})

describe('parseFamcStat - STAT ganda', () => {
  it('pakai STAT pertama yang sah, catat warning duplicate untuk kedua', () => {
    const famc = famcOnly()
    addStat(famc, 'PROVEN')
    addStat(famc, 'CHALLENGED')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('PROVEN')
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0]?.warning).toBe('duplicate-stat')
    expect(res.warnings[0]?.raw).toBe('CHALLENGED')
  })

  it('STAT pertama invalid tidak menghalangi STAT kedua yang sah', () => {
    const famc = famcOnly()
    addStat(famc, 'MAYBE')
    addStat(famc, 'PROVEN')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('PROVEN')
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0]?.warning).toBe('invalid-stat')
  })
})

describe('parseFamcStat - tanpa STAT dan struct lain', () => {
  it('FAMC tanpa STAT kembali nihil tanpa warning', () => {
    const famc = famcOnly()
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings).toEqual([])
  })

  it('struct FAMC undefined kembali nihil tanpa warning', () => {
    const res = parseFamcStat(undefined)
    expect(res.value).toBeUndefined()
    expect(res.warnings).toEqual([])
  })

  it('substructure lain (NOTE) diabaikan tanpa warning', () => {
    const famc = famcOnly()
    new GEDCStruct('NOTE', famc, undefined, 'catatan')
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(res.warnings).toEqual([])
  })
})

describe('serializeFamcStat', () => {
  it('hasilkan lini STAT untuk ketiga nilai enum', () => {
    expect(serializeFamcStat('CHALLENGED')).toBe('STAT CHALLENGED')
    expect(serializeFamcStat('DISPROVEN')).toBe('STAT DISPROVEN')
    expect(serializeFamcStat('PROVEN')).toBe('STAT PROVEN')
  })

  it('nihil menghasilkan undefined sehingga tanpa lini STAT', () => {
    expect(serializeFamcStat(undefined)).toBeUndefined()
  })

  it('nilai di luar enum tidak pernah diserialisasi', () => {
    const liar = 'PROVENN' as unknown as FamcStatValue
    expect(serializeFamcStat(liar)).toBeUndefined()
  })

  it('serializeFamcStatStruct: struct STAT dengan payload benar', () => {
    const head = new GEDCStruct('HEAD', undefined)
    const indi = new GEDCStruct('INDI', head)
    const famc = new GEDCStruct('FAMC', indi, undefined, '@F1@')
    const stat = serializeFamcStatStruct('PROVEN', famc)
    expect(stat).toBeDefined()
    expect(stat?.tag).toBe('STAT')
    expect(stat?.payload).toBe('PROVEN')
  })

  it('serializeFamcStatStruct: nihil menghasilkan undefined tanpa struct baru', () => {
    const head = new GEDCStruct('HEAD', undefined)
    const indi = new GEDCStruct('INDI', head)
    const famc = new GEDCStruct('FAMC', indi, undefined, '@F1@')
    const before = famc.sub.length
    expect(serializeFamcStatStruct(undefined, famc)).toBeUndefined()
    expect(famc.sub.length).toBe(before)
  })
})

describe('round-trip pasangan parse-serialize', () => {
  it('round-trip utuh: parse, serialize, parse lagi, nilai stabil', () => {
    const src = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 FAMC @F1@',
      '2 STAT PROVEN',
      '0 TRLR',
    ].join('\n')
    const famc = firstFamc(src)
    const first = parseFamcStat(famc)
    expect(first.value).toBe('PROVEN')
    const line = serializeFamcStat(first.value)
    expect(line).toBe('STAT PROVEN')
    const famc2 = firstFamc(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 FAMC @F1@',
        `2 ${line!}`,
        '0 TRLR',
      ].join('\n'),
    )
    const second = parseFamcStat(famc2)
    expect(second.value).toBe(first.value)
    expect(second.warnings).toEqual([])
  })

  it('round-trip nihil: tanpa STAT tetap tanpa STAT, output tidak berubah', () => {
    const src = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 FAMC @F1@',
      '0 TRLR',
    ].join('\n')
    const famc = firstFamc(src)
    const res = parseFamcStat(famc)
    expect(res.value).toBeUndefined()
    expect(serializeFamcStat(res.value)).toBeUndefined()
    const statLines = src.split('\n').filter((l) => l.trim().endsWith('STAT')).length
    expect(statLines).toBe(0)
  })

  it('fixture inline ala maximal70: FAMC dengan STAT PROVEN urai utuh', () => {
    const src = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SOUR Stemmagraph',
      '0 @I1@ INDI',
      '1 NAME Anak /Kandung/',
      '1 SEX M',
      '1 FAMC @F1@',
      '2 STAT PROVEN',
      '0 @I2@ INDI',
      '1 NAME Ayah /Contoh/',
      '1 SEX M',
      '1 FAMS @F1@',
      '0 @F1@ FAM',
      '1 HUSB @I2@',
      '1 CHIL @I1@',
      '0 TRLR',
      '',
    ].join('\n')
    const records = GEDCStruct.fromString(src, g7ConfGEDC)
    const indi = records.find((r) => r.tag === 'INDI')
    const famc = indi?.sub.find((s) => s.tag === 'FAMC')
    const res = parseFamcStat(famc)
    expect(res.value).toBe('PROVEN')
    expect(res.warnings).toEqual([])
    expect(serializeFamcStat(res.value)).toBe('STAT PROVEN')
  })

  it('round-trip ketiga enum lewat teks GEDCOM utuh', () => {
    const vals: FamcStatValue[] = ['CHALLENGED', 'DISPROVEN', 'PROVEN']
    for (const v of vals) {
      const famc = firstFamc(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @I1@ INDI',
          '1 FAMC @F1@',
          `2 STAT ${v}`,
          '0 TRLR',
        ].join('\n'),
      )
      const res = parseFamcStat(famc)
      expect(res.value).toBe(v)
      expect(serializeFamcStat(res.value)).toBe(`STAT ${v}`)
    }
  })
})
