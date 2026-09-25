// Test wiring PEDI dan ADOP-FAMC pada importFamilies (STG v159 fase iii-b,
// GOAL v159-STG-T0D-RELATIONSHIPS-RT-GAP): tangkap sub PEDI di bawah tiap
// CHIL plus enum ADOP di bawah event ADOP.FAMC bila ada, resolusi lewat
// resolvePedi/resolveAdop, nilai asing jadi phrase verbatim (pola webtrees),
// pointer CHIL duplikat tak boleh crash, round-trip byte-identical vendor.

import { describe, expect, it } from 'vitest'
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import { importFamilies } from './importFamilies'

/**
 * Bantu: GEDCOM dengan satu FAM @F1@ berbaris bebas. Record INDI I1..I4
 * disediakan agar semua pointer CHIL/HUSB/WIFE resolve di lapisan vendor
 * (pointer tak resolve dihapus vendor, bukan difabrikasi).
 */
function fam(lines: string[]): string {
  return [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '0 @I1@ INDI',
    '0 @I2@ INDI',
    '0 @I3@ INDI',
    '0 @I4@ INDI',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 WIFE @I2@',
    ...lines,
    '0 TRLR',
    '',
  ].join('\n')
}

describe('importFamilies - PEDI dan ADOP-FAMC (v159 iii-b)', () => {
  it('(a) FAM tanpa PEDI: childLinks nihil entri tanpa error', () => {
    const out = importFamilies(fam(['1 CHIL @I3@']))
    expect(out).toHaveLength(1)
    expect(out[0]!.children).toEqual(['I3'])
    expect(out[0]!.childLinks).toEqual([])
  })

  it('(b) CHIL PEDI BIRTH: known true, value terisi', () => {
    const out = importFamilies(fam(['1 CHIL @I3@', '2 PEDI BIRTH']))
    expect(out[0]!.childLinks).toHaveLength(1)
    expect(out[0]!.childLinks?.[0]?.fam).toBe('F1')
    expect(out[0]!.childLinks?.[0]?.pedi).toEqual({
      value: 'BIRTH',
      phrase: null,
      raw: 'BIRTH',
      known: true,
    })
  })

  it('(c) CHIL PEDI ADOPTED: known true', () => {
    const out = importFamilies(fam(['1 CHIL @I3@', '2 PEDI ADOPTED']))
    expect(out[0]!.childLinks?.[0]?.pedi).toEqual({
      value: 'ADOPTED',
      phrase: null,
      raw: 'ADOPTED',
      known: true,
    })
  })

  it('(d) PEDI OTHER dengan PHRASE: phrase tersimpan verbatim', () => {
    const out = importFamilies(fam([
      '1 CHIL @I3@',
      '2 PEDI OTHER',
      '3 PHRASE anak diangkat menurut adat',
    ]))
    expect(out[0]!.childLinks?.[0]?.pedi).toEqual({
      value: 'OTHER',
      phrase: 'anak diangkat menurut adat',
      raw: 'OTHER',
      known: true,
    })
  })

  it('(e) PEDI RADA nilai asing: known false, phrase raw utuh', () => {
    const out = importFamilies(fam(['1 CHIL @I3@', '2 PEDI RADA']))
    expect(out[0]!.childLinks?.[0]?.pedi).toEqual({
      value: null,
      phrase: 'RADA',
      raw: 'RADA',
      known: false,
    })
  })

  it('(f) SEALING tanpa event ADOP: tetap sah tanpa error', () => {
    const out = importFamilies(fam(['1 CHIL @I3@', '2 PEDI SEALING']))
    expect(out[0]!.childLinks?.[0]?.pedi?.value).toBe('SEALING')
    expect(out[0]!.childLinks?.[0]?.pedi?.known).toBe(true)
    expect(out[0]!.childLinks?.[0]?.adop).toBeUndefined()
  })

  it('(g) dua CHIL beda PEDI dalam satu FAM: entri urut file', () => {
    const out = importFamilies(fam([
      '1 CHIL @I3@',
      '2 PEDI BIRTH',
      '1 CHIL @I4@',
      '2 PEDI FOSTER',
    ]))
    expect(out[0]!.children).toEqual(['I3', 'I4'])
    expect(out[0]!.childLinks).toHaveLength(2)
    expect(out[0]!.childLinks?.[0]?.pedi?.value).toBe('BIRTH')
    expect(out[0]!.childLinks?.[1]?.pedi?.value).toBe('FOSTER')
  })

  it('(h) pointer CHIL duplikat: tak crash, entri per kemunculan', () => {
    const out = importFamilies(fam([
      '1 CHIL @I3@',
      '2 PEDI BIRTH',
      '1 CHIL @I3@',
      '2 PEDI ADOPTED',
    ]))
    expect(out[0]!.children).toEqual(['I3', 'I3'])
    expect(out[0]!.childLinks).toHaveLength(2)
    expect(out[0]!.childLinks?.[0]?.pedi?.value).toBe('BIRTH')
    expect(out[0]!.childLinks?.[1]?.pedi?.value).toBe('ADOPTED')
  })

  it('(i) FAM tanpa CHIL: children kosong, childLinks nihil entri', () => {
    const out = importFamilies(fam([]))
    expect(out[0]!.children).toEqual([])
    expect(out[0]!.childLinks).toEqual([])
  })

  it('(j) round-trip: fromString lalu toString PEDI byte-identical', () => {
    // Catatan mekanika vendor: xref record hanya tercetak ulang bila record
    // itu jadi target minimal satu pointer (#ref). Karena itu fixture di
    // sini sengaja membuat semua INDI dan FAM tertunjuk (pola helper iii-a).
    const plain = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @I3@ INDI',
      '1 FAMC @F1@',
      '0 @I4@ INDI',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '2 PEDI ADOPTED',
      '1 CHIL @I4@',
      '2 PEDI BIRTH',
      '0 TRLR',
      '',
    ].join('\n')
    expect(GEDCStruct.fromString(plain, g7ConfGEDC).toString()).toBe(plain)
    const lengkap = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @I3@ INDI',
      '1 FAMC @F1@',
      '0 @I4@ INDI',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '2 PEDI OTHER',
      '3 PHRASE anak diangkat menurut adat',
      '2 ADOP',
      '3 FAMC @F1@',
      '4 ADOP BOTH',
      '1 CHIL @I4@',
      '2 PEDI SEALING',
      '0 TRLR',
      '',
    ].join('\n')
    expect(GEDCStruct.fromString(lengkap, g7ConfGEDC).toString()).toBe(lengkap)
  })

  it('(k) event ADOP dengan FAMC ADOP HUSB: adop known true', () => {
    const out = importFamilies(fam([
      '1 CHIL @I3@',
      '2 PEDI ADOPTED',
      '2 ADOP',
      '3 FAMC @F1@',
      '4 ADOP HUSB',
    ]))
    expect(out[0]!.childLinks?.[0]?.adop).toEqual({
      value: 'HUSB',
      phrase: null,
      raw: 'HUSB',
      known: true,
    })
  })

  it('(l) ADOP nilai asing: known false, phrase raw utuh', () => {
    const out = importFamilies(fam([
      '1 CHIL @I3@',
      '2 ADOP',
      '3 FAMC @F1@',
      '4 ADOP KEDUANYA',
    ]))
    expect(out[0]!.childLinks?.[0]?.pedi).toBeUndefined()
    expect(out[0]!.childLinks?.[0]?.adop).toEqual({
      value: null,
      phrase: 'KEDUANYA',
      raw: 'KEDUANYA',
      known: false,
    })
  })
})
