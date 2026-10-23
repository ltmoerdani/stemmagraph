import { describe, expect, it } from 'vitest'
import { computeSourceRecordStats } from './source-record-stats'

describe('computeSourceRecordStats', () => {
  it('kasus a: kedua input kosong menghasilkan null', () => {
    expect(computeSourceRecordStats({ sources: [], citations: [] })).toBeNull()
  })

  it('kasus b: sources kosong tapi citations ada tetap diproses, semua citation dangling', () => {
    const r = computeSourceRecordStats({
      sources: [],
      citations: [{ sourcePointer: '@S1@' }, { sourcePointer: '@S2@' }],
    })
    expect(r).not.toBeNull()
    expect(r!.totalSources).toBe(0)
    expect(r!.danglingCitations).toBe(2)
  })

  it('kasus c: hitungan dasar tiap bucket', () => {
    const sources = [
      { xref: '@S1@' },
      { xref: '@S2@' },
      { xref: '@S3@' },
      { xref: '@S4@' },
      { xref: '@S5@' },
    ]
    const citations = [
      { sourcePointer: '@S2@' },
      { sourcePointer: '@S3@' }, { sourcePointer: '@S3@' }, { sourcePointer: '@S3@' },
      ...Array.from({ length: 5 }, () => ({ sourcePointer: '@S4@' })),
      ...Array.from({ length: 10 }, () => ({ sourcePointer: '@S5@' })),
    ]
    const r = computeSourceRecordStats({ sources, citations })
    expect(r!.buckets).toEqual({ zero: 1, one: 1, twoToFour: 1, fiveToNine: 1, tenPlus: 1 })
    expect(r!.totalSources).toBe(5)
  })

  it('kasus d: orphan xref urut localeCompare ASC', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S9@' }, { xref: '@S1@' }, { xref: '@S5@' }],
      citations: [],
    })
    expect(r!.orphanXrefs).toEqual(['@S1@', '@S5@', '@S9@'])
    expect(r!.buckets.zero).toBe(3)
  })

  it('kasus e: dangling citation terhitung bukan crash', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@' }],
      citations: [{ sourcePointer: '@S1@' }, { sourcePointer: '@SX@' }],
    })
    expect(r!.danglingCitations).toBe(1)
    expect(r!.buckets.one).toBe(1)
  })

  it('kasus f: xref duplikat di sources di-dedupe, pertama menang', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: 'pertama' }, { xref: '@S1@', note: '' }],
      citations: [{ sourcePointer: '@S1@' }],
    })
    expect(r!.totalSources).toBe(1)
    expect(r!.notes.withNote).toBe(1)
  })

  it('kasus g: note saja dihitung withNote dan noteCount', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: 'sumber wajib pajak' }, { xref: '@S2@' }],
      citations: [],
    })
    expect(r!.notes).toEqual({ withNote: 1, withoutNote: 1, noteCount: 1, snoteCount: 0, totalNotes: 1 })
  })

  it('kasus h: snote saja dihitung withNote dan snoteCount', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', snote: 'structured' }],
      citations: [],
    })
    expect(r!.notes.snoteCount).toBe(1)
    expect(r!.notes.noteCount).toBe(0)
    expect(r!.notes.totalNotes).toBe(1)
    expect(r!.notes.withNote).toBe(1)
  })

  it('kasus i: note dan snote keduanya pada satu source', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: 'a', snote: 'b' }],
      citations: [],
    })
    expect(r!.notes).toEqual({ withNote: 1, withoutNote: 0, noteCount: 1, snoteCount: 1, totalNotes: 2 })
  })

  it('kasus j: note string kosong dihitung tanpa note', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: '' }, { xref: '@S2@', snote: '' }],
      citations: [],
    })
    expect(r!.notes.withNote).toBe(0)
    expect(r!.notes.withoutNote).toBe(2)
    expect(r!.notes.totalNotes).toBe(0)
  })

  it('kasus k: bucket tenPlus ambang 10', () => {
    const citations = Array.from({ length: 10 }, () => ({ sourcePointer: '@S1@' }))
    const r = computeSourceRecordStats({ sources: [{ xref: '@S1@' }], citations })
    expect(r!.buckets.tenPlus).toBe(1)
    expect(r!.buckets.fiveToNine).toBe(0)
  })

  it('kasus l: bucket fiveToNine ambang atas 9', () => {
    const citations = Array.from({ length: 9 }, () => ({ sourcePointer: '@S1@' }))
    const r = computeSourceRecordStats({ sources: [{ xref: '@S1@' }], citations })
    expect(r!.buckets.fiveToNine).toBe(1)
    expect(r!.buckets.tenPlus).toBe(0)
  })

  it('kasus m: throw bila input bukan objek', () => {
    expect(() => computeSourceRecordStats(null as unknown as never)).toThrow(/input bukan objek/)
    expect(() => computeSourceRecordStats([1] as unknown as never)).toThrow(/input bukan objek/)
  })

  it('kasus n: throw bila sources bukan array', () => {
    expect(() => computeSourceRecordStats({ sources: 'x', citations: [] } as never)).toThrow(/sources: payload bukan array/)
  })

  it('kasus o: throw bila citations bukan array', () => {
    expect(() => computeSourceRecordStats({ sources: [], citations: 5 } as never)).toThrow(/citations: payload bukan array/)
  })

  it('kasus p: throw bila xref bukan string atau kosong, ber-index', () => {
    expect(() => computeSourceRecordStats({ sources: [{ xref: 1 }], citations: [] } as never)).toThrow(/source-record-stats\[0\]\.xref: bukan string/)
    expect(() => computeSourceRecordStats({ sources: [{ xref: '' }], citations: [] })).toThrow(/source-record-stats\[0\]\.xref: kosong/)
  })

  it('kasus q: throw bila sourcePointer bukan string atau kosong', () => {
    expect(() => computeSourceRecordStats({ sources: [], citations: [{ sourcePointer: null }] } as never)).toThrow(/source-record-stats\[0\]\.sourcePointer: bukan string/)
    expect(() => computeSourceRecordStats({ sources: [], citations: [{ sourcePointer: '' }] })).toThrow(/source-record-stats\[0\]\.sourcePointer: kosong/)
  })

  it('kasus r: throw bila note bukan string', () => {
    expect(() => computeSourceRecordStats({ sources: [{ xref: '@S1@', note: 7 }], citations: [] } as never)).toThrow(/source-record-stats\[0\]\.note: bukan string/)
    expect(() => computeSourceRecordStats({ sources: [{ xref: '@S1@', snote: {} }], citations: [] } as never)).toThrow(/source-record-stats\[0\]\.snote: bukan string/)
  })

  it('kasus s: deterministik urutan input beda hasil sama', () => {
    const a = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: 'n' }, { xref: '@S2@' }],
      citations: [{ sourcePointer: '@S1@' }, { sourcePointer: '@S2@' }, { sourcePointer: '@S2@' }],
    })
    const b = computeSourceRecordStats({
      sources: [{ xref: '@S2@' }, { xref: '@S1@', note: 'n' }],
      citations: [{ sourcePointer: '@S2@' }, { sourcePointer: '@S1@' }, { sourcePointer: '@S2@' }],
    })
    expect(a).toEqual(b)
  })

  it('kasus t: duplikat citation ke source sama menaikkan bucket dengan benar', () => {
    const citations = Array.from({ length: 4 }, () => ({ sourcePointer: '@S1@' }))
    const r = computeSourceRecordStats({ sources: [{ xref: '@S1@' }], citations })
    expect(r!.buckets.twoToFour).toBe(1)
  })

  it('kasus u: persentase per bucket terhadap totalSources', () => {
    const sources = [
      { xref: '@S1@' },
      { xref: '@S2@' },
      { xref: '@S3@' },
      { xref: '@S4@' },
    ]
    const citations = [
      { sourcePointer: '@S2@' },
      { sourcePointer: '@S3@' }, { sourcePointer: '@S3@' }, { sourcePointer: '@S3@' },
      ...Array.from({ length: 10 }, () => ({ sourcePointer: '@S4@' })),
    ]
    const r = computeSourceRecordStats({ sources, citations })
    expect(r!.totalSources).toBe(4)
    expect(r!.bucketPercentages).toEqual({
      zero: 25,
      one: 25,
      twoToFour: 25,
      fiveToNine: 0,
      tenPlus: 25,
    })
  })

  it('kasus v: pembulatan persentase 2 desimal', () => {
    const sources = Array.from({ length: 3 }, (_, i) => ({ xref: `@S${i + 1}@` }))
    const r = computeSourceRecordStats({
      sources,
      citations: [{ sourcePointer: '@S1@' }],
    })
    expect(r!.bucketPercentages.zero).toBeCloseTo(66.67, 2)
    expect(r!.bucketPercentages.one).toBeCloseTo(33.33, 2)
    expect(r!.bucketPercentages.twoToFour).toBe(0)
  })

  it('kasus w: percentWithNote sesuai semantik v377c', () => {
    const r = computeSourceRecordStats({
      sources: [
        { xref: '@S1@', note: 'a' },
        { xref: '@S2@', snote: 'b' },
        { xref: '@S3@' },
        { xref: '@S4@', note: '' },
      ],
      citations: [],
    })
    expect(r!.notes.withNote).toBe(2)
    expect(r!.percentWithNote).toBe(50)
  })

  it('kasus x: avgNotesPerSource = totalNotes / totalSources dibulatkan 2 desimal', () => {
    const r = computeSourceRecordStats({
      sources: [
        { xref: '@S1@', note: 'a', snote: 'b' },
        { xref: '@S2@', note: 'c' },
        { xref: '@S3@' },
      ],
      citations: [],
    })
    expect(r!.notes.totalNotes).toBe(3)
    expect(r!.avgNotesPerSource).toBe(1)
  })

  it('kasus y: avgNotesPerSource pecahan membulat 2 desimal', () => {
    const r = computeSourceRecordStats({
      sources: [{ xref: '@S1@', note: 'a', snote: 'b' }],
      citations: [],
    })
    expect(r!.notes.totalNotes).toBe(2)
    expect(r!.avgNotesPerSource).toBeCloseTo(2, 2)
  })

  it('kasus z: totalSources nol, metric turunan aman tanpa NaN', () => {
    const r = computeSourceRecordStats({
      sources: [],
      citations: [{ sourcePointer: '@SX@' }],
    })
    expect(r).not.toBeNull()
    expect(r!.totalSources).toBe(0)
    expect(r!.bucketPercentages).toEqual({ zero: 0, one: 0, twoToFour: 0, fiveToNine: 0, tenPlus: 0 })
    expect(r!.percentWithNote).toBe(0)
    expect(r!.avgNotesPerSource).toBe(0)
  })
})
