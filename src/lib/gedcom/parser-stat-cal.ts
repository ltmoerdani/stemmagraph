/**
 * GEDCOM 7 parser helper for FAMC-STAT and Calendar Date specifications.
 * Pure module: no external imports, no fs, no server.
 */

export type FamcStatResult =
  | { kind: 'enum'; value: 'CHALLENGED' | 'DISPROVEN' | 'PROVEN' }
  | { kind: 'raw'; value: string };

export function parseFamcStat(raw: string): FamcStatResult {
  const trimmed = raw.trim();
  if (trimmed === 'CHALLENGED' || trimmed === 'DISPROVEN' || trimmed === 'PROVEN') {
    return { kind: 'enum', value: trimmed };
  }
  // Value lain (termasuk extTag underscore) dikembalikan utuh tanpa normalisasi.
  return { kind: 'raw', value: raw };
}

export interface CalendarDateResult {
  calendarTag?: string;
  dateString: string;
  phrase?: string;
  rangeType?:
    | 'FROM-TO'
    | 'BET-AND'
    | 'FROM'
    | 'TO'
    | 'BEFORE'
    | 'AFTER'
    | 'ABOUT'
    | 'EXACT';
  raw: string;
}

export function parseCalendarDate(raw: string): CalendarDateResult {
  const trimmed = raw.trim();
  let calendarTag: string | undefined;
  let rest = trimmed;

  // GEDCOM 7 section 6.3: tag kalender mengikat date sesudahnya.
  // Bentuk kanonik payload: @#DGREGORIAN@ <date> (juga diterima prefiks polos).
  const atForm = rest.match(/^@#D([A-Za-z0-9_]+)@\s*(.*)$/);
  if (atForm) {
    calendarTag = atForm[1].toUpperCase();
    rest = atForm[2];
  } else {
    const plainForm = rest.match(/^(GREGORIAN|JULIAN|FRENCH_R|HEBREW|_[A-Za-z0-9_]+)\s+(.*)$/);
    if (plainForm) {
      calendarTag = plainForm[1].toUpperCase();
      rest = plainForm[2];
    }
  }

  // Dual date: DATE plus PHRASE, phrase dipertahankan utuh.
  let phrase: string | undefined;
  const phraseMatch = rest.match(/^\s*(.*?)\s*\(PHRASE:\s*(.*?)\)\s*$/i);
  if (phraseMatch) {
    rest = phraseMatch[1];
    phrase = phraseMatch[2];
  }

  // FROM-TO dan BET-AND adalah dua semantik berbeda; jangan tertukar.
  let rangeType: CalendarDateResult['rangeType'] = 'EXACT';
  const upperRest = rest.toUpperCase();
  if (upperRest.startsWith('FROM ') && /\sTO\s/.test(upperRest)) {
    rangeType = 'FROM-TO';
  } else if (upperRest.startsWith('BET ') && /\sAND\s/.test(upperRest)) {
    rangeType = 'BET-AND';
  } else if (upperRest.startsWith('FROM ')) {
    rangeType = 'FROM';
  } else if (upperRest.startsWith('BEFORE ')) {
    rangeType = 'BEFORE';
  } else if (upperRest.startsWith('AFTER ')) {
    rangeType = 'AFTER';
  } else if (upperRest.startsWith('ABT ') || upperRest.startsWith('ABOUT ')) {
    rangeType = 'ABOUT';
  }

  const result: CalendarDateResult = {
    dateString: rest,
    rangeType,
    raw,
  };
  if (calendarTag !== undefined) {
    result.calendarTag = calendarTag;
  }
  if (phrase !== undefined) {
    result.phrase = phrase;
  }
  return result;
}
