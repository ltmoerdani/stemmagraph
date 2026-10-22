import { describe, expect, it } from 'vitest'
import {
  computeRecordInventory,
  type RecordEntry,
  type RecordKind,
} from './record-inventory'

function entry(recordId: string, kind: RecordKind): RecordEntry {
  return { recordId, kind }
}

describe('computeRecordInventory', () => {
  it('campuran 7 kind sekali jalan dengan hitungan benar', () => {
    const result = computeRecordInventory([
      entry('I1', 'person'),
      entry('I2', 'person'),
      entry('I3', 'person'),
      entry('F1', 'family'),
      entry('F2', 'family'),
      entry('S1', 'source'),
      entry('M1', 'media'),
      entry('N1', 'note'),
      entry('R1', 'repository'),
      entry('L1', 'location'),
    ])
    expect(result.persons).toBe(3)
    expect(result.families).toBe(2)
    expect(result.sources).toBe(1)
    expect(result.media).toBe(1)
    expect(result.notes).toBe(1)
    expect(result.repositories).toBe(1)
    expect(result.locations).toBe(1)
    expect(result.core).toBe(5)
    expect(result.enrichment).toBe(5)
    expect(result.total).toBe(10)
    expect(result.densityPer100).toBe(166.7)
  })

  it('core = persons + families', () => {
    const result = computeRecordInventory([
      entry('I1', 'person'),
      entry('I2', 'person'),
      entry('I3', 'person'),
      entry('I4', 'person'),
      entry('F1', 'family'),
      entry('F2', 'family'),
      entry('F3', 'family'),
    ])
    expect(result.persons).toBe(4)
    expect(result.families).toBe(3)
    expect(result.core).toBe(7)
  })

  it('enrichment = jumlah 5 kategori', () => {
    const result = computeRecordInventory([
      entry('S1', 'source'),
      entry('S2', 'source'),
      entry('M1', 'media'),
      entry('N1', 'note'),
      entry('N2', 'note'),
      entry('N3', 'note'),
      entry('R1', 'repository'),
      entry('R2', 'repository'),
      entry('R3', 'repository'),
      entry('R4', 'repository'),
      entry('L1', 'location'),
    ])
    expect(result.sources).toBe(2)
    expect(result.media).toBe(1)
    expect(result.notes).toBe(3)
    expect(result.repositories).toBe(4)
    expect(result.locations).toBe(1)
    expect(result.enrichment).toBe(11)
  })

  it('density normal dengan pembulatan 1 desimal: 3 enrichment 7 persons = 42.9', () => {
    const result = computeRecordInventory([
      entry('I1', 'person'),
      entry('I2', 'person'),
      entry('I3', 'person'),
      entry('I4', 'person'),
      entry('I5', 'person'),
      entry('I6', 'person'),
      entry('I7', 'person'),
      entry('S1', 'source'),
      entry('M1', 'media'),
      entry('N1', 'note'),
    ])
    expect(result.persons).toBe(7)
    expect(result.enrichment).toBe(3)
    expect(result.densityPer100).toBe(42.9)
  })

  it('persons 0 dengan enrichment positif menghasilkan densityPer100 null', () => {
    const result = computeRecordInventory([
      entry('F1', 'family'),
      entry('S1', 'source'),
      entry('M1', 'media'),
    ])
    expect(result.persons).toBe(0)
    expect(result.enrichment).toBe(2)
    expect(result.densityPer100).toBeNull()
  })

  it('input kosong menghasilkan semua hitungan 0 dan densityPer100 null', () => {
    const result = computeRecordInventory([])
    expect(result).toEqual({
      persons: 0,
      families: 0,
      core: 0,
      sources: 0,
      media: 0,
      notes: 0,
      repositories: 0,
      locations: 0,
      enrichment: 0,
      total: 0,
      densityPer100: null,
    })
  })

  it('total = core + enrichment', () => {
    const result = computeRecordInventory([
      entry('I1', 'person'),
      entry('F1', 'family'),
      entry('S1', 'source'),
      entry('N1', 'note'),
      entry('L1', 'location'),
    ])
    expect(result.total).toBe(result.core + result.enrichment)
    expect(result.total).toBe(5)
  })

  it('recordId duplikat sah dan tetap dihitung per entri', () => {
    const result = computeRecordInventory([
      entry('I1', 'person'),
      entry('I1', 'person'),
      entry('I1', 'person'),
    ])
    expect(result.persons).toBe(3)
    expect(result.core).toBe(3)
    expect(result.total).toBe(3)
  })

  it('kind tak dikenal dilempar Error ber-index', () => {
    expect(() =>
      computeRecordInventory([
        entry('I1', 'person'),
        entry('X1', 'artifact' as RecordKind),
      ]),
    ).toThrowError(/record-inventory.*index 1.*bukan salah satu 7 nilai enum/)
  })

  it('kind bukan string dilempar Error ber-index', () => {
    expect(() =>
      computeRecordInventory([
        { recordId: 'I1', kind: 7 },
      ]),
    ).toThrowError(/record-inventory.*index 0.*kind harus string/)
  })

  it('recordId kosong dilempar Error ber-index', () => {
    expect(() =>
      computeRecordInventory([entry('', 'person')]),
    ).toThrowError(
      /record-inventory.*index 0.*recordId tidak boleh string kosong/,
    )
  })

  it('recordId bukan string dilempar Error ber-index', () => {
    expect(() =>
      computeRecordInventory([{ recordId: 42, kind: 'person' }]),
    ).toThrowError(/record-inventory.*index 0.*recordId harus string/)
  })

  it('entri bukan objek dilempar Error ber-index', () => {
    expect(() =>
      computeRecordInventory([
        entry('I1', 'person'),
        'person' as unknown as RecordEntry,
      ]),
    ).toThrowError(/record-inventory.*index 1.*bukan objek/)
  })

  it('entries bukan array dilempar Error', () => {
    expect(() =>
      computeRecordInventory('bukan array' as unknown),
    ).toThrowError(/record-inventory: input entries harus array/)
  })

  it('determinisme: dua urutan input berbeda menghasilkan objek identik', () => {
    const a = computeRecordInventory([
      entry('S1', 'source'),
      entry('I1', 'person'),
      entry('F1', 'family'),
      entry('I2', 'person'),
      entry('M1', 'media'),
    ])
    const b = computeRecordInventory([
      entry('M1', 'media'),
      entry('I2', 'person'),
      entry('F1', 'family'),
      entry('S1', 'source'),
      entry('I1', 'person'),
    ])
    expect(a).toEqual(b)
  })

  it('urutan field output tetap sesuai kontrak', () => {
    const result = computeRecordInventory([entry('I1', 'person')])
    expect(Object.keys(result)).toEqual([
      'persons',
      'families',
      'core',
      'sources',
      'media',
      'notes',
      'repositories',
      'locations',
      'enrichment',
      'total',
      'densityPer100',
    ])
  })
})
