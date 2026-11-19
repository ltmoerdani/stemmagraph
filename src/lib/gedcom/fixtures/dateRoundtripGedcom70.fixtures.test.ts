// Test round-trip DATE GEDCOM 7 (v459 unit 4, penutup sisa scope).
//
// Definisi lossless dua kelas atas 15 kasus fixtures
// (dateRoundtripGedcom70.fixtures.ts):
//
// KELAS VERBATIM (14 kasus): hasil parseEventDateExt diformat ulang
// lewat formatGedcomDateValueExt dan HARUS IDENTIK byte-per-byte dengan
// string DATE asli. Berlaku untuk EXACT (formatter menulis komponen
// tanpa zero-pad, presisi dipertahankan), PERIOD (FROM/TO
// direkonstruksi dari komponen bertingkat sama), dan CALENDAR (prefix
// escape, badan, dan epoch ditulis verbatim).
//
// KELAS CANONICAL (1 kasus, epoch-bce-polos): parser tidak memiliki
 // representasi terstruktur untuk epoch BCE tanpa prefix kalender
// (komponen ParsedEventDate tidak memuat epoch), sehingga hasil urai
// jatuh ke ABOUT tanpa komponen dan formatter kembali null sesuai
// kontrak (fallback raw jadi tugas pemanggil di lapisan export).
// Untuk kasus ini yang di-assert adalah originalDateString identik
// byte-per-byte dengan sumber plus formatter null; string tetap utuh
// tanpa normalisasi apa pun, hanya jalur simpannya yang beda.

import { describe, expect, it } from 'vitest'
import { parseEventDateExt } from '../parseEventDateExt'
import { formatGedcomDateValueExt } from '../formatGedcomDate'
import {
  DATE_FIXTURES_MAXIMAL70,
  DATE_FIXTURES_TURUNAN_GRAMMAR,
  DATE_ROUNDTRIP_FIXTURES,
  JUMLAH_KASUS_DATE_ROUNDTRIP,
  type DateRoundtripFixture,
} from './dateRoundtripGedcom70.fixtures'

/** Kasus kelas canonical: formatter null, verbatim lewat originalDateString. */
const KASUS_CANONICAL: ReadonlySet<string> = new Set(['epoch-bce-polos'])

describe('fixtures round-trip DATE: kelengkapan 15 kasus', () => {
  it('total kasus 15 sesuai rencana unit 4', () => {
    expect(JUMLAH_KASUS_DATE_ROUNDTRIP).toBe(15)
    expect(DATE_ROUNDTRIP_FIXTURES.length).toBe(15)
  })

  it('pembagian 11 dari maximal70 dan 4 turunan grammar', () => {
    expect(DATE_FIXTURES_MAXIMAL70.length).toBe(11)
    expect(DATE_FIXTURES_TURUNAN_GRAMMAR.length).toBe(4)
    expect(DATE_FIXTURES_MAXIMAL70.every((f) => f.asal === 'maximal70')).toBe(true)
    expect(DATE_FIXTURES_TURUNAN_GRAMMAR.every((f) => f.asal === 'turunan-grammar')).toBe(true)
  })

  it('semua id unik dan dateVerbatim tidak kosong', () => {
    const ids = DATE_ROUNDTRIP_FIXTURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DATE_ROUNDTRIP_FIXTURES.every((f) => f.dateVerbatim.length > 0)).toBe(true)
  })

  it('tanggal ber-kalender resmi dan turunan tercakup lengkap', () => {
    const ids = new Set(DATE_ROUNDTRIP_FIXTURES.map((f) => f.id))
    expect(ids.has('kalender-julian')).toBe(true)
    expect(ids.has('kalender-hebrew')).toBe(true)
    expect(ids.has('kalender-french-r')).toBe(true)
    expect(ids.has('epoch-bce-polos')).toBe(true)
    expect(ids.has('periode-from-to-phrase-event')).toBe(true)
    expect(ids.has('periode-from-to-phrase-sour-data')).toBe(true)
    expect(ids.has('date-time-phrase')).toBe(true)
    expect(ids.has('tahun-saja-marr')).toBe(true)
  })
})

describe('round-trip DATE per kasus', () => {
  for (const fx of DATE_ROUNDTRIP_FIXTURES) {
    it(`${fx.id}: ${fx.kelas}`, () => {
      const parsed = parseEventDateExt(fx.dateVerbatim)
      const formatted = formatGedcomDateValueExt(parsed)

      if (KASUS_CANONICAL.has(fx.id)) {
        // Kelas canonical: parser tidak merepresentasikan BCE tanpa
        // prefix kalender, formatter null sesuai kontrak, string asli
        // utuh di originalDateString tanpa normalisasi apa pun.
        expect(formatted).toBeNull()
        expect(parsed.originalDateString).toBe(fx.dateVerbatim)
        expect(parsed.dateKind).toBe('ABOUT')
      } else {
        // Kelas verbatim: identik byte-per-byte dengan string asli.
        expect(formatted).toBe(fx.dateVerbatim)
        expect(parsed.originalDateString).toBe(fx.dateVerbatim)
      }
    })
  }
})

describe('dateKind sesuai bentuk sumber', () => {
  const byId = new Map<string, DateRoundtripFixture>(
    DATE_ROUNDTRIP_FIXTURES.map((f) => [f.id, f]),
  )

  it('periode FROM/TO menghasilkan PERIOD', () => {
    const periode = ['periode-from-to-phrase-event', 'periode-from-to-phrase-sour-data']
    for (const id of periode) {
      const fx = byId.get(id)
      expect(fx).toBeDefined()
      expect(parseEventDateExt((fx as DateRoundtripFixture).dateVerbatim).dateKind).toBe('PERIOD')
    }
  })

  it('TO saja menghasilkan PERIOD dengan from kosong', () => {
    const fx = byId.get('periode-to-saja-phrase')
    expect(fx).toBeDefined()
    const r = parseEventDateExt((fx as DateRoundtripFixture).dateVerbatim)
    expect(r.dateKind).toBe('PERIOD')
    if (r.dateKind === 'PERIOD') expect(r.from).toBeNull()
  })

  it('tiga kalender resmi menghasilkan CALENDAR tanpa isu', () => {
    const kalender = ['kalender-julian', 'kalender-hebrew', 'kalender-french-r']
    for (const id of kalender) {
      const fx = byId.get(id)
      expect(fx).toBeDefined()
      const r = parseEventDateExt((fx as DateRoundtripFixture).dateVerbatim)
      expect(r.dateKind).toBe('CALENDAR')
      if (r.dateKind === 'CALENDAR') expect(r.issues).toBeUndefined()
    }
  })

  it('tanggal eksak dan tahun saja menghasilkan EXACT', () => {
    const eksak = [
      'head-date-time', 'date-time-phrase', 'eksak-hari-bulan-tahun-polos',
      'eksak-buri-type', 'eksak-hari-satu-digit-jan', 'eksak-hari-satu-digit-chr',
      'eksak-27-mar-berulang', 'tahun-saja-marr',
    ]
    for (const id of eksak) {
      const fx = byId.get(id)
      expect(fx).toBeDefined()
      expect(parseEventDateExt((fx as DateRoundtripFixture).dateVerbatim).dateKind).toBe('EXACT')
    }
  })
})
