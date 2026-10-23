// Citation note stats module: counts structured NOTE and SNOTE payloads
// attached to source citations.
//
// DEFINITION: an entry is "with note" when its note (structured NOTE) or
// its snote (SNOTE) is a non-empty string. Empty strings count as no note
// on that field. noteCount and snoteCount are tallied independently;
// totalNotes is their sum. withAnyNote covers entries with at least one
// non-empty field, withoutNote the rest.
//
// SEMANTIC BASIS: GEDCOM NOTE and SNOTE subrecords attached to SOUR
// (source citation) structures, matching how imports expose citation-level
// free text in this codebase.
//
// percentWithNote = 100 x withAnyNote / total, rounded to 2 decimals via
// Math.round(x * 100) / 100 (same rounding pattern as existing stats
// modules, extended to 2 decimals). avgNotesPerCitation = totalNotes /
// total with the same 2-decimal rounding.
//
// Strict indexed parser: throws on non-array payload, non-object entry,
// non-string or empty sourcePointer, and note or snote present but not a
// string. Error messages carry the citation-note-stats[N] prefix.
//
// Empty entries array: returns null.
//
// Pure module: no server imports, no prisma, no fetch, no network.
// Deterministic: input order does not affect the result.

export interface CitationNoteStatsEntry {
  sourcePointer: string;
  note?: string;
  snote?: string;
}

export interface CitationNoteStats {
  total: number;
  withAnyNote: number;
  withoutNote: number;
  noteCount: number;
  snoteCount: number;
  totalNotes: number;
  percentWithNote: number;
  avgNotesPerCitation: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeCitationNoteStats(
  entries: CitationNoteStatsEntry[]
): CitationNoteStats | null {
  if (!Array.isArray(entries)) {
    throw new Error('citation-note-stats: entries: payload bukan array');
  }

  if (entries.length === 0) {
    return null;
  }

  let withAnyNote = 0;
  let noteCount = 0;
  let snoteCount = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const raw: unknown = entries[index];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`citation-note-stats[${index}]: bukan objek`);
    }

    const entry = raw as {
      sourcePointer?: unknown;
      note?: unknown;
      snote?: unknown;
    };

    if (typeof entry.sourcePointer !== 'string') {
      throw new Error(
        `citation-note-stats[${index}].sourcePointer: bukan string`
      );
    }
    if (entry.sourcePointer === '') {
      throw new Error(`citation-note-stats[${index}].sourcePointer: kosong`);
    }

    if (entry.note !== undefined) {
      if (typeof entry.note !== 'string') {
        throw new Error(`citation-note-stats[${index}].note: bukan string`);
      }
      if (entry.note !== '') {
        noteCount += 1;
      }
    }

    if (entry.snote !== undefined) {
      if (typeof entry.snote !== 'string') {
        throw new Error(`citation-note-stats[${index}].snote: bukan string`);
      }
      if (entry.snote !== '') {
        snoteCount += 1;
      }
    }

    const hasNote = entry.note !== undefined && entry.note !== '';
    const hasSnote = entry.snote !== undefined && entry.snote !== '';
    if (hasNote || hasSnote) {
      withAnyNote += 1;
    }
  }

  const total = entries.length;
  const totalNotes = noteCount + snoteCount;

  return {
    total,
    withAnyNote,
    withoutNote: total - withAnyNote,
    noteCount,
    snoteCount,
    totalNotes,
    percentWithNote: round2((100 * withAnyNote) / total),
    avgNotesPerCitation: round2(totalNotes / total),
  };
}
