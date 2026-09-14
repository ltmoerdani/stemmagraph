// Unit test lib impor GEDZIP (S1F5-C).
//
// Fokus: perilaku importGedzip pada arsip buatan: round-trip nyata
// terhadap zipSync fflate (pola exportGedzip), pencarian entry
// gedcom.ged secara case-insensitive dan di path bersarang,
// determinisme saat kandidat lebih dari satu, serta kegagalan eksplisit
// (arsip tanpa .ged, input bukan zip). Kasus non-UTF8 mengunci
// perilaku TextDecoder default: byte tak valid diganti U+FFFD.

import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { importGedzip } from './importGedzip'

const SAMPLE_GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 CHAR',
  '2 FORM UTF-8',
  '0 @I1@ INDI',
  '1 NAME Nama Contoh',
  '0 TRLR',
].join('\n')

function encodeGedcom(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('importGedzip', () => {
  it('round-trip: mengembalikan teks GEDCOM identik dari arsip zipSync', () => {
    const zip = zipSync({ 'gedcom.ged': encodeGedcom(SAMPLE_GEDCOM) })
    expect(importGedzip(zip)).toBe(SAMPLE_GEDCOM)
  })

  it('round-trip dengan exportGedzip: packageGedzip lalu importGedzip membaliknya', async () => {
    const { packageGedzip } = await import('./exportGedzip')
    const packaged = packageGedzip(SAMPLE_GEDCOM, {
      mtime: new Date('2026-09-14T00:00:00Z'),
    })
    assert(packaged.ok)
    expect(importGedzip(packaged.zip)).toBe(SAMPLE_GEDCOM)
  })

  it('nama entry case berbeda (GEDCOM.GED) tetap ditemukan', () => {
    const zip = zipSync({ 'GEDCOM.GED': encodeGedcom(SAMPLE_GEDCOM) })
    expect(importGedzip(zip)).toBe(SAMPLE_GEDCOM)
  })

  it('entry di path bersarang tetap ditemukan', () => {
    const zip = zipSync({
      'docs/family/gedcom.ged': encodeGedcom(SAMPLE_GEDCOM),
    })
    expect(importGedzip(zip)).toBe(SAMPLE_GEDCOM)
  })

  it('kandidat ganda dipilih deterministik sesuai urutan nama', () => {
    const zip = zipSync({
      'gedcom.ged': encodeGedcom('0 HEAD\n0 TRLR\n'),
      'backup/GEDCOM.GED': encodeGedcom(SAMPLE_GEDCOM),
    })
    // 'backup/gedcom.ged' urut lebih awal daripada 'gedcom.ged'.
    expect(importGedzip(zip)).toBe(SAMPLE_GEDCOM)
  })

  it('arsip tanpa entry .ged melempar Error dengan pesan jelas', () => {
    const zip = zipSync({ 'readme.txt': encodeGedcom('bukan gedcom') })
    expect(() => importGedzip(zip)).toThrowError(/gedcom\.ged/)
  })

  it('data bukan zip melempar Error', () => {
    const notZip = encodeGedcom('ini hanyalah teks biasa, bukan arsip')
    expect(() => importGedzip(notZip)).toThrowError(/not a readable GEDZIP archive/)
  })

  it('byte non-UTF8 didekode dengan penggantian U+FFFD sesuai TextDecoder default', () => {
    const bytes = new Uint8Array([
      0x30, 0x20, 0x40, 0x49, 0x31, 0x40, 0x20, 0x49, 0x4e, 0x44, 0x49, 0x0a,
      0xff, 0xfe,
    ])
    const zip = zipSync({ 'gedcom.ged': bytes })
    const text = importGedzip(zip)
    expect(text.startsWith('0 @I1@ INDI\n')).toBe(true)
    expect(text).toContain('\uFFFD')
  })
})

function assert(condition: boolean): asserts condition {
  if (!condition) throw new Error('expected packaged.ok')
}
