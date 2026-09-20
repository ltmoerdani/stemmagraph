import { describe, expect, it } from 'vitest';
import { dateCalPayload, famcStatPayload } from './stat-cal-import';

describe('famcStatPayload', () => {
  it('mengenali CHALLENGED sebagai enum', () => {
    expect(famcStatPayload('CHALLENGED')).toEqual({ kind: 'enum', value: 'CHALLENGED' });
  });

  it('mengenali DISPROVEN sebagai enum', () => {
    expect(famcStatPayload('DISPROVEN')).toEqual({ kind: 'enum', value: 'DISPROVEN' });
  });

  it('mengenali PROVEN sebagai enum', () => {
    expect(famcStatPayload('PROVEN')).toEqual({ kind: 'enum', value: 'PROVEN' });
  });

  it('ekstensi underscore dikembalikan raw utuh tanpa normalisasi', () => {
    expect(famcStatPayload('_custom_stat')).toEqual({ kind: 'raw', value: '_custom_stat' });
  });
});

describe('dateCalPayload', () => {
  it('tag GREGORIAN terdeteksi', () => {
    const result = dateCalPayload('@#DGREGORIAN@ 15 APR 1900');
    expect(result.calendarTag).toBe('GREGORIAN');
    expect(result.dateString).toBe('15 APR 1900');
    expect(result.rangeType).toBe('EXACT');
  });

  it('tag HEBREW terdeteksi tanpa konversi', () => {
    const result = dateCalPayload('@#DHEBREW@ 1 TSH 5760');
    expect(result.calendarTag).toBe('HEBREW');
    expect(result.dateString).toBe('1 TSH 5760');
    expect(result.rangeType).toBe('EXACT');
  });

  it('PHRASE dipertahankan utuh', () => {
    const result = dateCalPayload('25 MAR 1732 (PHRASE: Old Style 14 MAR 1731/32)');
    expect(result.phrase).toBe('Old Style 14 MAR 1731/32');
    expect(result.dateString).toBe('25 MAR 1732');
    expect(result.raw).toBe('25 MAR 1732 (PHRASE: Old Style 14 MAR 1731/32)');
  });

  it('payload malformed aman tanpa throw', () => {
    expect(() => dateCalPayload('@#D@@ ((bogus')).not.toThrow();
    expect(() => dateCalPayload('')).not.toThrow();
    const result = dateCalPayload('@#D@@ ((bogus');
    expect(result.raw).toBe('@#D@@ ((bogus');
    expect(result.dateString).toBe('@#D@@ ((bogus');
    expect(result.rangeType).toBe('EXACT');
  });
});
