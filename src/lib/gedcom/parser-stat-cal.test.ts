import { describe, expect, it } from 'vitest';
import { parseCalendarDate, parseFamcStat } from './parser-stat-cal';

describe('parseFamcStat', () => {
  it('menerima CHALLENGED sebagai enum', () => {
    expect(parseFamcStat('CHALLENGED')).toEqual({ kind: 'enum', value: 'CHALLENGED' });
  });

  it('menerima DISPROVEN sebagai enum', () => {
    expect(parseFamcStat('DISPROVEN')).toEqual({ kind: 'enum', value: 'DISPROVEN' });
  });

  it('menerima PROVEN sebagai enum', () => {
    expect(parseFamcStat('PROVEN')).toEqual({ kind: 'enum', value: 'PROVEN' });
  });

  it('ekstensi underscore dikembalikan raw utuh tanpa normalisasi', () => {
    expect(parseFamcStat('_CUSTOM_STAT')).toEqual({ kind: 'raw', value: '_CUSTOM_STAT' });
  });

  it('round-trip: nilai enum menghasilkan payload identik', () => {
    const raw = 'PROVEN';
    const parsed = parseFamcStat(raw);
    expect(parsed.kind === 'enum' ? parsed.value : parsed.value).toBe(raw);
  });
});

describe('parseCalendarDate', () => {
  it('kalender GREGORIAN terdeteksi dan mengikat date sesudahnya', () => {
    const result = parseCalendarDate('@#DGREGORIAN@ 15 APR 1900');
    expect(result.calendarTag).toBe('GREGORIAN');
    expect(result.dateString).toBe('15 APR 1900');
  });

  it('kalender JULIAN terdeteksi', () => {
    const result = parseCalendarDate('@#DJULIAN@ 4 OCT 1582');
    expect(result.calendarTag).toBe('JULIAN');
    expect(result.dateString).toBe('4 OCT 1582');
  });

  it('kalender FRENCH_R terdeteksi', () => {
    const result = parseCalendarDate('@#DFRENCH_R@ 12 VEND 3');
    expect(result.calendarTag).toBe('FRENCH_R');
    expect(result.dateString).toBe('12 VEND 3');
  });

  it('kalender HEBREW terdeteksi', () => {
    const result = parseCalendarDate('@#DHEBREW@ 1 TSH 5760');
    expect(result.calendarTag).toBe('HEBREW');
    expect(result.dateString).toBe('1 TSH 5760');
  });

  it('kalender ekstensi underscore terdeteksi tanpa normalisasi', () => {
    const result = parseCalendarDate('@#D_CUSTOM@ 5 JAN 2000');
    expect(result.calendarTag).toBe('_CUSTOM');
    expect(result.dateString).toBe('5 JAN 2000');
  });

  it('dual date: PHRASE dipertahankan utuh dan round-trip', () => {
    const raw = '@#DGREGORIAN@ 25 MAR 1732 (PHRASE: Old Style 14 MAR 1731/32)';
    const result = parseCalendarDate(raw);
    expect(result.calendarTag).toBe('GREGORIAN');
    expect(result.phrase).toBe('Old Style 14 MAR 1731/32');
    expect(result.dateString).toBe('25 MAR 1732');
    expect(result.raw).toBe(raw);
  });

  it('FROM-TO diparsing sebagai range FROM-TO', () => {
    const result = parseCalendarDate('FROM 1 JAN 1900 TO 31 DEC 1900');
    expect(result.rangeType).toBe('FROM-TO');
    expect(result.dateString).toBe('FROM 1 JAN 1900 TO 31 DEC 1900');
  });

  it('BET-AND diparsing sebagai range BET-AND, tidak tertukar dengan FROM-TO', () => {
    const result = parseCalendarDate('BET 1 JAN 1900 AND 30 JUN 1900');
    expect(result.rangeType).toBe('BET-AND');
    expect(result.rangeType).not.toBe('FROM-TO');
    expect(result.dateString).toBe('BET 1 JAN 1900 AND 30 JUN 1900');
  });

  it('HEBREW ADR tidak dinormalisasi ke ADS, nilai asli utuh', () => {
    const raw = '@#DHEBREW@ 5 ADR 5700';
    const result = parseCalendarDate(raw);
    expect(result.calendarTag).toBe('HEBREW');
    expect(result.dateString).toContain('ADR');
    expect(result.dateString).not.toContain('ADS');
  });

  it('payload malformed tetap aman tanpa throw', () => {
    expect(() => parseCalendarDate('')).not.toThrow();
    expect(() => parseFamcStat('')).not.toThrow();
    const broken = parseCalendarDate('@#D@@@ ...');
    expect(broken.raw).toBe('@#D@@@ ...');
    expect(parseFamcStat('')).toEqual({ kind: 'raw', value: '' });
  });
});
