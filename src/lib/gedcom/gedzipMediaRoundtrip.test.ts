// Unit test round-trip GEDZIP media + gate OBJE (STG v467-B1).
//
// Fokus: kemas teks GEDCOM 7 berisi record OBJE via packageGedzip,
// buka lagi via importGedzip, lalu jalankan scanObjeGate terhadap
// hasilnya. Teks hasil round-trip harus identik dengan teks asli,
// dokumen sah lolos gate tanpa error, dan dua pelanggaran
// kardinalitas (FILE tanpa FORM, OBJE tanpa FILE) tetap utuh setelah
// round-trip serta ditolak gate dengan kode stabil.
//
// Catatan penyelarasan anchor: exportGedzip menuntut input aplikasi
// penuh (ExportGedcom70Input), jadi lapisan ZIP diuji langsung lewat
// packageGedzip, fungsi yang juga dipanggil exportGedzip secara
// internal. Makna tiap kasus tetap: kemas GEDZIP, buka, lalu gate.

import { describe, expect, it } from 'vitest'
import { importGedzip } from './importGedzip'
import { packageGedzip } from './exportGedzip'
import { scanObjeGate } from './objeGate'

const MEDIA_GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 CHAR',
  '2 FORM UTF-8',
  '0 @I1@ INDI',
  '1 OBJE @O1@',
  '0 @O1@ OBJE',
  '1 FILE https://example.com/photo.jpg',
  '2 FORM image/jpeg',
  '0 TRLR',
].join('\n')

function buildArchive(text: string, mtime?: Date) {
  const packaged = packageGedzip(text, mtime ? { mtime } : undefined)
  if (!packaged.ok) throw new Error('fixture uji ditolak guard limit packageGedzip')
  return packaged.zip
}

describe('gedzip media round-trip + OBJE gate', () => {
  it('kasus 1: round-trip kemas lalu buka menghasilkan teks identik byte-per-byte', () => {
    const zip = buildArchive(MEDIA_GEDCOM)
    expect(importGedzip(zip)).toBe(MEDIA_GEDCOM)
  })

  it('kasus 2: teks hasil round-trip lolos scanObjeGate tanpa error', () => {
    const zip = buildArchive(MEDIA_GEDCOM)
    const text = importGedzip(zip)
    expect(scanObjeGate(text)).toEqual([])
  })

  it('kasus 3: FILE tanpa FORM tetap utuh dan ditolak gate dengan FILE_NO_FORM', () => {
    const broken = MEDIA_GEDCOM
      .split('\n')
      .filter((line) => line !== '2 FORM image/jpeg')
      .join('\n')
    const zip = buildArchive(broken)
    const text = importGedzip(zip)
    expect(text).toBe(broken)
    const errors = scanObjeGate(text)
    expect(errors.length).toBeGreaterThan(0)
    const [first] = errors
    expect(first?.code).toBe('FILE_NO_FORM')
  })

  it('kasus 4: OBJE tanpa FILE tetap utuh dan ditolak gate dengan OBJE_NO_FILE', () => {
    const broken = MEDIA_GEDCOM
      .split('\n')
      .filter(
        (line) =>
          line !== '1 FILE https://example.com/photo.jpg' &&
          line !== '2 FORM image/jpeg',
      )
      .join('\n')
    const zip = buildArchive(broken)
    const text = importGedzip(zip)
    expect(text).toBe(broken)
    const errors = scanObjeGate(text)
    expect(errors.some((e) => e.code === 'OBJE_NO_FILE')).toBe(true)
  })

  it('kasus 5: round-trip dengan mtime eksplisit tetap menghasilkan teks identik', () => {
    const zip = buildArchive(MEDIA_GEDCOM, new Date('2026-11-27T00:00:00Z'))
    expect(importGedzip(zip)).toBe(MEDIA_GEDCOM)
  })

  it('kasus 6: input bukan arsip ZIP gagal eksplisit sebagai Error', () => {
    expect(() => importGedzip(new TextEncoder().encode('bukan arsip'))).toThrow(Error)
  })
})
