// Source record stats module (v378 fase i-iii): buckets sources by citation
// count and audits note coverage on the source level.
//
// DEFINITION: each source is bucketed by how many citations point at its
// xref through citation.sourcePointer. Buckets: 0 citations = zero,
// 1 = one, 2 to 4 = twoToFour, 5 to 9 = fiveToNine, 10 or more = tenPlus.
// Bucket values are absolute source counts and their sum equals
// totalSources.
//
// orphanXrefs lists sources with zero citations, sorted ASC via
// localeCompare. A citation whose sourcePointer matches no known xref is
// counted in danglingCitations (not a crash, not silently ignored).
// Duplicate xrefs in sources are deduped, first occurrence wins; later
// duplicates are validated but excluded from all tallies.
//
// notes: withNote counts sources whose note OR snote is a non-empty
// string. Empty strings count as no note on that field. noteCount and
// snoteCount are tallied independently; totalNotes is their sum.
// withoutNote is totalSources minus withNote.
//
// Phase iii (v378): bucketPercentages reports each bucket as a share of
// totalSources. percentWithNote is the share of sources carrying a note.
// avgNotesPerSource = totalNotes / totalSources. All three use round2
// (Math.round(x * 100) / 100, same pattern as citation-note-stats).
// totalSources of zero yields 0 for every derived value, no NaN.
//
// SEMANTIC BASIS: GEDCOM SOUR records at the source level (xref, NOTE,
// SNOTE) and SOUR citations pointing at them via sourcePointer, matching
// how imports expose sources in this codebase. Inline VISION
// VISION-stemmagraph T0d statistik GEDCOM 7, kelanjutan rangkaian v377.
//
// Empty input (no sources AND no citations): returns null. Sources empty
// with citations present still processes: all buckets zero, every
// citation dangles.
//
// Strict indexed parser: throws when input is not an object, sources or
// citations is not an array, xref or sourcePointer is not a string or is
// empty, and when note or snote is present but not a string. Error
// messages carry the source-record-stats[N] prefix.
//
// Pure module: no server imports, no prisma, no fetch, no network.
// Deterministic: input order does not affect the result.
export interface SourceRecordStatsSource {
  xref: string;
  note?: string;
  snote?: string;
}

export interface SourceRecordStatsCitation {
  sourcePointer: string;
}

export interface SourceRecordStatsInput {
  sources: SourceRecordStatsSource[];
  citations: SourceRecordStatsCitation[];
}

export interface SourceRecordStatsBuckets {
  zero: number;
  one: number;
  twoToFour: number;
  fiveToNine: number;
  tenPlus: number;
}

export interface SourceRecordStatsNotes {
  withNote: number;
  withoutNote: number;
  noteCount: number;
  snoteCount: number;
  totalNotes: number;
}

export interface SourceRecordStatsBucketPercentages {
  zero: number;
  one: number;
  twoToFour: number;
  fiveToNine: number;
  tenPlus: number;
}

export interface SourceRecordStats {
  totalSources: number;
  buckets: SourceRecordStatsBuckets;
  bucketPercentages: SourceRecordStatsBucketPercentages;
  orphanXrefs: string[];
  notes: SourceRecordStatsNotes;
  percentWithNote: number;
  avgNotesPerSource: number;
  danglingCitations: number;
}

interface ValidatedSource {
  xref: string;
  note?: string;
  snote?: string;
}

function validateSource(
  raw: unknown,
  index: number
): ValidatedSource {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`source-record-stats[${index}]: bukan objek`);
  }

  const entry = raw as {
    xref?: unknown;
    note?: unknown;
    snote?: unknown;
  };

  if (typeof entry.xref !== 'string') {
    throw new Error(`source-record-stats[${index}].xref: bukan string`);
  }
  if (entry.xref === '') {
    throw new Error(`source-record-stats[${index}].xref: kosong`);
  }

  if (entry.note !== undefined && typeof entry.note !== 'string') {
    throw new Error(`source-record-stats[${index}].note: bukan string`);
  }
  if (entry.snote !== undefined && typeof entry.snote !== 'string') {
    throw new Error(`source-record-stats[${index}].snote: bukan string`);
  }

  return {
    xref: entry.xref,
    note: entry.note,
    snote: entry.snote,
  };
}

function validateCitation(
  raw: unknown,
  index: number
): string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`source-record-stats[${index}]: bukan objek`);
  }

  const entry = raw as { sourcePointer?: unknown };

  if (typeof entry.sourcePointer !== 'string') {
    throw new Error(
      `source-record-stats[${index}].sourcePointer: bukan string`
    );
  }
  if (entry.sourcePointer === '') {
    throw new Error(
      `source-record-stats[${index}].sourcePointer: kosong`
    );
  }

  return entry.sourcePointer;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeSourceRecordStats(
  input: SourceRecordStatsInput
): SourceRecordStats | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('source-record-stats: input bukan objek');
  }

  if (!Array.isArray(input.sources)) {
    throw new Error('source-record-stats: sources: payload bukan array');
  }
  if (!Array.isArray(input.citations)) {
    throw new Error('source-record-stats: citations: payload bukan array');
  }

  if (input.sources.length === 0 && input.citations.length === 0) {
    return null;
  }

  // Phase 1: validate every entry, duplicates included, so bad payloads
  // always throw regardless of dedupe outcome.
  const validatedSources = input.sources.map((source, index) =>
    validateSource(source, index)
  );
  const pointers = input.citations.map((citation, index) =>
    validateCitation(citation, index)
  );

  // Phase 2: dedupe sources by xref, first occurrence wins, then tally.
  const byXref = new Map<string, ValidatedSource>();
  for (const source of validatedSources) {
    if (!byXref.has(source.xref)) {
      byXref.set(source.xref, source);
    }
  }

  const citationCounts = new Map<string, number>();
  let danglingCitations = 0;
  for (const pointer of pointers) {
    if (byXref.has(pointer)) {
      citationCounts.set(pointer, (citationCounts.get(pointer) ?? 0) + 1);
    } else {
      danglingCitations += 1;
    }
  }

  const buckets: SourceRecordStatsBuckets = {
    zero: 0,
    one: 0,
    twoToFour: 0,
    fiveToNine: 0,
    tenPlus: 0,
  };
  const orphanXrefs: string[] = [];
  let withNote = 0;
  let noteCount = 0;
  let snoteCount = 0;

  for (const [xref, source] of byXref) {
    const count = citationCounts.get(xref) ?? 0;
    if (count === 0) {
      buckets.zero += 1;
      orphanXrefs.push(xref);
    } else if (count === 1) {
      buckets.one += 1;
    } else if (count <= 4) {
      buckets.twoToFour += 1;
    } else if (count <= 9) {
      buckets.fiveToNine += 1;
    } else {
      buckets.tenPlus += 1;
    }

    const hasNote = source.note !== undefined && source.note !== '';
    const hasSnote = source.snote !== undefined && source.snote !== '';
    if (hasNote) {
      noteCount += 1;
    }
    if (hasSnote) {
      snoteCount += 1;
    }
    if (hasNote || hasSnote) {
      withNote += 1;
    }
  }

  orphanXrefs.sort((a, b) => a.localeCompare(b));

  const totalSources = byXref.size;
  const totalNotes = noteCount + snoteCount;
  const percentage = (part: number): number =>
    totalSources === 0 ? 0 : round2((100 * part) / totalSources);

  return {
    totalSources,
    buckets,
    bucketPercentages: {
      zero: percentage(buckets.zero),
      one: percentage(buckets.one),
      twoToFour: percentage(buckets.twoToFour),
      fiveToNine: percentage(buckets.fiveToNine),
      tenPlus: percentage(buckets.tenPlus),
    },
    orphanXrefs,
    notes: {
      withNote,
      withoutNote: totalSources - withNote,
      noteCount,
      snoteCount,
      totalNotes,
    },
    percentWithNote: percentage(withNote),
    avgNotesPerSource:
      totalSources === 0 ? 0 : round2(totalNotes / totalSources),
    danglingCitations,
  };
}
