// Unit test lib pipeline impor (S1F6-C).
//
// Fokus: deteksi magic ZIP, jalur gedzip vs gedcom, round-trip nyata
// lewat exportGedcom70 lalu extractGedcom balik, dan kegagalan
// eksplisit arsip bukan ZIP bermagic ZIP palsu.

import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import {
  detectUploadKind,
  extractGedcom,
} from './importPipeline'
import { buildImportPlan } from './importPlan'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'

const GEDCOM_MINIMAL = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 CHAR',
  '2 FORM UTF-8',
  '0 @I1@ INDI',
  '1 NAME Nama Contoh',
  '1 SEX M',
  '0 TRLR',
].join('\n')

function encodeGedcom(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('detectUploadKind', () => {
  it('gedzip: byte PK\\x03\\x04 terdeteksi gedzip', () => {
    const zip = zipSync({ 'gedcom.ged': encodeGedcom(GEDCOM_MINIMAL) })
    expect(detectUploadKind(zip)).toBe('gedzip')
  })

  it('gedcom: teks polos terdeteksi gedcom', () => {
    expect(detectUploadKind(encodeGedcom(GEDCOM_MINIMAL))).toBe('gedcom')
  })

  it('byte kurang dari 4 aman dan terdeteksi gedcom', () => {
    expect(detectUploadKind(new Uint8Array([0x50, 0x4b]))).toBe('gedcom')
    expect(detectUploadKind(new Uint8Array())).toBe('gedcom')
  })

  it('magic parsial PK tanpa 03 04 bukan gedzip', () => {
    expect(
      detectUploadKind(new Uint8Array([0x50, 0x4b, 0x01, 0x02])),
    ).toBe('gedcom')
  })
})

describe('extractGedcom', () => {
  it('gedzip: mengembalikan teks GEDCOM identik dari arsip zipSync', () => {
    const zip = zipSync({ 'gedcom.ged': encodeGedcom(GEDCOM_MINIMAL) })
    const result = extractGedcom(zip)
    expect(result.kind).toBe('gedzip')
    expect(result.text).toBe(GEDCOM_MINIMAL)
  })

  it('gedzip: entry bersarang dan nama huruf besar tetap ditemukan', () => {
    const zip = zipSync({ 'x/y/GEDCOM.GED': encodeGedcom(GEDCOM_MINIMAL) })
    const result = extractGedcom(zip)
    expect(result.kind).toBe('gedzip')
    expect(result.text).toBe(GEDCOM_MINIMAL)
  })

  it('gedcom: teks polos didekode UTF-8 utuh', () => {
    const result = extractGedcom(encodeGedcom(GEDCOM_MINIMAL))
    expect(result.kind).toBe('gedcom')
    expect(result.text).toBe(GEDCOM_MINIMAL)
  })

  it('gedzip: arsip tanpa entry gedcom.ged melempar Error eksplisit', () => {
    const zip = zipSync({ 'catatan.txt': encodeGedcom('isi biasa') })
    expect(() => extractGedcom(zip)).toThrowError(/gedcom.ged/)
  })

  it('magic ZIP palsu tanpa arsip sah melempar Error, tidak macet diam', () => {
    const fake = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01])
    expect(() => extractGedcom(fake)).toThrowError()
  })

  it('round-trip: teks hasil ekstraksi parse balik jadi plan utuh', () => {
    const plan = buildImportPlan(
      importIndividuals(GEDCOM_MINIMAL),
      importFamilies(GEDCOM_MINIMAL),
    )
    expect(plan.members).toHaveLength(1)
    expect(plan.members[0]?.xref).toBe('I1')
    expect(plan.members[0]?.name).toBe('Nama Contoh')
    expect(plan.members[0]?.gender).toBe('male')
  })
})
