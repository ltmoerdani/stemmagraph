// Test schema-gate (STG v120 fase ii): laporan reject per baris di atas
// tabel struktur fase i. Cakupan: root legal, unknown_structure, extension
// underscore, kardinalitas {1:1}/{0:1}/{1:M}/{1:2}, agregasi checkedCount,
// determinisme laporan, dan urutan beberapa issue yang stabil.

import { describe, expect, it, vi } from 'vitest'
import { runSchemaGate } from './schema-gate'
import type { SchemaGateEntry, SchemaGateReport } from './schema-gate'
import type { StructureEntry } from './structure-lookup'

// Tabel resmi tidak punya entri dengan max 2 (hanya 1 atau M), sedangkan
// kasus 8 dan 9 butuh batas tepat 2. Mock tipis di bawah mendelegasikan
// semua pasangan lain ke modul asli, lalu menambahkan satu superstructure
// sintetis ber-kardinalitas {1:2}.
vi.mock('./structure-lookup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./structure-lookup')>()
  const extra: Record<string, Record<string, StructureEntry>> = {
    'https://example.com/v120-test/PARENT': {
      EXAC: {
        uri: 'https://example.com/v120-test/EXAC',
        cardinality: '{1:2}',
        payload: null,
      },
    },
  }
  return {
    ...actual,
    lookupStructure: (superUri: string, tag: string) =>
      extra[superUri]?.[tag] ?? actual.lookupStructure(superUri, tag),
  }
})

const HEAD = 'https://gedcom.io/terms/v7/HEAD'
const OBJE = 'https://gedcom.io/terms/v7/record-OBJE'
const SYNTH_PARENT = 'https://example.com/v120-test/PARENT'
const SYNTH_EXAC = 'https://example.com/v120-test/EXAC'

/** Entri gate minimal agar tiap kasus ringkas dibaca. */
function e(line: number, superstructureUri: string, tag: string): SchemaGateEntry {
  return { line, superstructureUri, tag }
}

describe('tabel resmi: struktur dikenal dan kardinalitas', () => {
  it('(1) root HEAD tunggal lolos tanpa issue', () => {
    const r = runSchemaGate([e(1, '', 'HEAD')])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(1)
    expect(r.extensionCount).toBe(0)
  })

  it('(2) tag tak dikenal dilaporkan unknown_structure pada baris tepat', () => {
    const r = runSchemaGate([e(42, '', 'BROKEN')])
    expect(r.issues).toEqual([
      { line: 42, structureUri: '', tag: 'BROKEN', reason: 'unknown_structure' },
    ])
    expect(r.checkedCount).toBe(0)
    expect(r.extensionCount).toBe(0)
  })

  it('(3) tag underscore dihitung sebagai extension tanpa ditolak', () => {
    const r = runSchemaGate([e(7, '', '_RAKA')])
    expect(r.issues).toEqual([])
    expect(r.extensionCount).toBe(1)
    expect(r.checkedCount).toBe(0)
  })

  it('(4) {1:1} dilanggar kemunculan kedua, issue menunjuk baris kedua', () => {
    const r = runSchemaGate([e(1, '', 'HEAD'), e(50, '', 'HEAD')])
    expect(r.issues).toEqual([
      {
        line: 50,
        structureUri: HEAD,
        tag: 'HEAD',
        reason: 'cardinality_violated',
      },
    ])
    expect(r.checkedCount).toBe(1)
  })

  it('(5) {0:1} dilanggar kemunculan kedua, issue menunjuk baris kedua', () => {
    const r = runSchemaGate([e(3, HEAD, 'DATE'), e(9, HEAD, 'DATE')])
    expect(r.issues).toEqual([
      {
        line: 9,
        structureUri: 'https://gedcom.io/terms/v7/HEAD-DATE',
        tag: 'DATE',
        reason: 'cardinality_violated',
      },
    ])
    // Kemunculan pertama masih dalam batas {0:1} dan tetap terhitung checked.
    expect(r.checkedCount).toBe(1)
  })

  it('(6) {0:1} yang absen aman tanpa issue', () => {
    const r = runSchemaGate([e(1, '', 'HEAD'), e(2, HEAD, 'GEDC')])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(2)
  })

  it('(7) {1:M} dengan banyak kemunculan aman', () => {
    const r = runSchemaGate([
      e(10, OBJE, 'FILE'),
      e(11, OBJE, 'FILE'),
      e(12, OBJE, 'FILE'),
      e(13, OBJE, 'FILE'),
    ])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(4)
  })
})

describe('batas max 2 via superstructure sintetis', () => {
  it('(8) tepat dua kemunculan saat max 2 aman', () => {
    const r = runSchemaGate([e(10, SYNTH_PARENT, 'EXAC'), e(11, SYNTH_PARENT, 'EXAC')])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(2)
  })

  it('(9) kemunculan ketiga saat max 2 dilanggar, menunjuk baris ketiga', () => {
    const r = runSchemaGate([
      e(10, SYNTH_PARENT, 'EXAC'),
      e(11, SYNTH_PARENT, 'EXAC'),
      e(12, SYNTH_PARENT, 'EXAC'),
    ])
    expect(r.issues).toEqual([
      {
        line: 12,
        structureUri: SYNTH_EXAC,
        tag: 'EXAC',
        reason: 'cardinality_violated',
      },
    ])
    expect(r.checkedCount).toBe(2)
  })
})

describe('agregasi dan stabilitas laporan', () => {
  it('(10) checkedCount mencakup semua entri legal pada input campuran', () => {
    const r = runSchemaGate([
      e(1, '', 'HEAD'),
      e(2, HEAD, 'GEDC'),
      e(3, '', 'INDI'),
      e(9, '', 'INDI'),
      e(15, '', '_EXT'),
    ])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(4)
    expect(r.extensionCount).toBe(1)
  })

  it('(10b) pelanggaran dihitung checked hanya sampai batas max', () => {
    const r = runSchemaGate([e(1, '', 'HEAD'), e(2, HEAD, 'GEDC'), e(3, '', 'HEAD')])
    expect(r.issues).toHaveLength(1)
    expect(r.checkedCount).toBe(2)
  })

  it('(11) input identik dua kali menghasilkan laporan deep-equal', () => {
    const input: SchemaGateEntry[] = [
      e(1, '', 'HEAD'),
      e(2, HEAD, 'BOGUS'),
      e(3, '', 'HEAD'),
      e(4, '', '_EXT'),
      e(5, HEAD, 'DATE'),
      e(6, HEAD, 'DATE'),
    ]
    const a: SchemaGateReport = runSchemaGate(input)
    const b: SchemaGateReport = runSchemaGate(input)
    expect(a).toStrictEqual(b)
  })

  it('(12) superstructureUri kosong diterima sebagai root dokumen', () => {
    const r = runSchemaGate([e(1, '', 'TRLR')])
    expect(r.issues).toEqual([])
    expect(r.checkedCount).toBe(1)
  })

  it('(13) issue unknown memuat URI superstructure induknya', () => {
    const r = runSchemaGate([e(7, HEAD, 'BOGUS')])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]?.structureUri).toBe(HEAD)
    expect(r.issues[0]?.reason).toBe('unknown_structure')
  })

  it('(14) beberapa issue sekaligus keluar dengan urutan stabil', () => {
    const input: SchemaGateEntry[] = [
      e(1, '', 'HEAD'),
      e(2, HEAD, 'BOGUS'),
      e(3, '', 'HEAD'),
      e(4, '', '_X'),
      e(5, HEAD, 'DATE'),
      e(6, HEAD, 'DATE'),
    ]
    const expected = [
      { line: 2, structureUri: HEAD, tag: 'BOGUS', reason: 'unknown_structure' },
      { line: 3, structureUri: HEAD, tag: 'HEAD', reason: 'cardinality_violated' },
      {
        line: 6,
        structureUri: 'https://gedcom.io/terms/v7/HEAD-DATE',
        tag: 'DATE',
        reason: 'cardinality_violated',
      },
    ]
    const r = runSchemaGate(input)
    expect(r.issues).toEqual(expected)
    expect(runSchemaGate(input).issues).toEqual(expected)
    expect(r.extensionCount).toBe(1)
  })
})
