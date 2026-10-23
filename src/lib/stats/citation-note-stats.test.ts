import { describe, expect, it } from 'vitest';
import { computeCitationNoteStats } from './citation-note-stats';

describe('computeCitationNoteStats', () => {
  it('(a) returns null for empty entries', () => {
    expect(computeCitationNoteStats([])).toBeNull();
  });

  it('(b) counts basic totals across mixed entries', () => {
    const entries = [
      { sourcePointer: 'S1', note: 'n1' },
      { sourcePointer: 'S2', snote: 's1' },
      { sourcePointer: 'S3' },
    ];
    expect(computeCitationNoteStats(entries)).toEqual({
      total: 3,
      withAnyNote: 2,
      withoutNote: 1,
      noteCount: 1,
      snoteCount: 1,
      totalNotes: 2,
      percentWithNote: 66.67,
      avgNotesPerCitation: 0.67,
    });
  });

  it('(c) counts note only', () => {
    const entries = [
      { sourcePointer: 'S1', note: 'n1' },
      { sourcePointer: 'S2' },
    ];
    expect(computeCitationNoteStats(entries)).toMatchObject({
      withAnyNote: 1,
      noteCount: 1,
      snoteCount: 0,
      totalNotes: 1,
    });
  });

  it('(d) counts snote only', () => {
    const entries = [
      { sourcePointer: 'S1', snote: 's1' },
      { sourcePointer: 'S2' },
    ];
    expect(computeCitationNoteStats(entries)).toMatchObject({
      withAnyNote: 1,
      noteCount: 0,
      snoteCount: 1,
      totalNotes: 1,
    });
  });

  it('(e) counts note and snote on the same entry', () => {
    const entries = [
      { sourcePointer: 'S1', note: 'n1', snote: 's1' },
      { sourcePointer: 'S2' },
    ];
    expect(computeCitationNoteStats(entries)).toMatchObject({
      withAnyNote: 1,
      noteCount: 1,
      snoteCount: 1,
      totalNotes: 2,
      percentWithNote: 50,
      avgNotesPerCitation: 1,
    });
  });

  it('(f) empty strings on both fields count as no note', () => {
    const entries = [
      { sourcePointer: 'S1', note: '', snote: '' },
      { sourcePointer: 'S2', note: 'n1' },
    ];
    expect(computeCitationNoteStats(entries)).toMatchObject({
      withAnyNote: 1,
      withoutNote: 1,
      noteCount: 1,
      snoteCount: 0,
      totalNotes: 1,
      percentWithNote: 50,
      avgNotesPerCitation: 0.5,
    });
  });

  it('(g) rounds percentWithNote to 2 decimals', () => {
    // 1 / 3 = 33.333... -> 33.33
    const entries = [
      { sourcePointer: 'S1', note: 'n1' },
      { sourcePointer: 'S2' },
      { sourcePointer: 'S3' },
    ];
    expect(computeCitationNoteStats(entries)?.percentWithNote).toBe(33.33);
  });

  it('(h) rounds avgNotesPerCitation to 2 decimals', () => {
    // 2 notes over 3 citations = 0.6666... -> 0.67
    const entries = [
      { sourcePointer: 'S1', note: 'n1' },
      { sourcePointer: 'S2', snote: 's1' },
      { sourcePointer: 'S3' },
    ];
    expect(computeCitationNoteStats(entries)?.avgNotesPerCitation).toBe(0.67);
  });

  it('(i) all entries without notes yield zero counters', () => {
    const entries = [
      { sourcePointer: 'S1' },
      { sourcePointer: 'S2', note: '', snote: '' },
    ];
    expect(computeCitationNoteStats(entries)).toMatchObject({
      total: 2,
      withAnyNote: 0,
      withoutNote: 2,
      noteCount: 0,
      snoteCount: 0,
      totalNotes: 0,
      percentWithNote: 0,
      avgNotesPerCitation: 0,
    });
  });

  it('(j) throws on non-array payload', () => {
    expect(() =>
      computeCitationNoteStats(undefined as unknown as never[])
    ).toThrow(/payload bukan array/);
  });

  it('(k) throws on non-object entry', () => {
    expect(() =>
      computeCitationNoteStats(['S1'] as unknown as never[])
    ).toThrow(/citation-note-stats\[0\]: bukan objek/);
  });

  it('(l) throws on empty sourcePointer', () => {
    expect(() =>
      computeCitationNoteStats([{ sourcePointer: '', note: 'n1' }])
    ).toThrow(/citation-note-stats\[0\]\.sourcePointer: kosong/);
  });

  it('(m) throws on non-string sourcePointer', () => {
    expect(() =>
      computeCitationNoteStats([
        { sourcePointer: 7 } as unknown as { sourcePointer: string },
      ])
    ).toThrow(/citation-note-stats\[0\]\.sourcePointer: bukan string/);
  });

  it('(n) throws on non-string note', () => {
    expect(() =>
      computeCitationNoteStats([
        { sourcePointer: 'S1', note: 42 } as unknown as {
          sourcePointer: string;
          note?: string;
        },
      ])
    ).toThrow(/citation-note-stats\[0\]\.note: bukan string/);
  });

  it('(o) throws on non-string snote', () => {
    expect(() =>
      computeCitationNoteStats([
        { sourcePointer: 'S1', snote: null } as unknown as {
          sourcePointer: string;
          snote?: string;
        },
      ])
    ).toThrow(/citation-note-stats\[0\]\.snote: bukan string/);
  });

  it('(p) deterministic regardless of input order', () => {
    const entries = [
      { sourcePointer: 'S1', note: 'n1' },
      { sourcePointer: 'S2', snote: 's1' },
      { sourcePointer: 'S3' },
    ];
    const forward = computeCitationNoteStats(entries);
    const backward = computeCitationNoteStats([...entries].reverse());
    expect(forward).toEqual(backward);
  });
});
