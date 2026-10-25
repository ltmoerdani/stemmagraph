// Unit tests for the pure next-anniversaries module (v387 reminder haul).
// Covers: strict date parsing (calendar validity, leap years), the
// merged birthday + wedding sort, tie-breaks, window edges (today and
// days boundary), Feb 29 handling, broken-date exclusion, determinism,
// and time injection via Date or { y, m, d }.

import { describe, expect, it } from 'vitest';
import {
  computeNextAnniversaries,
  parseAnniversaryYmd,
  type NextAnniversaryInput,
} from './nextAnniversaries';

const NOW = { y: 2026, m: 10, d: 24 };

function item(overrides: Partial<NextAnniversaryInput>): NextAnniversaryInput {
  return {
    kind: 'birthday',
    refId: 'p-1',
    displayName: 'Adi',
    date: '1990-10-24',
    ...overrides,
  };
}

function compute(items: NextAnniversaryInput[], days = 30, now: typeof NOW | Date = NOW) {
  return computeNextAnniversaries(items, now, days);
}

describe('parseAnniversaryYmd (strict parser)', () => {
  it('accepts full YYYY-MM-DD with Gregorian validation', () => {
    expect(parseAnniversaryYmd('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseAnniversaryYmd(' 1990-01-31 ')).toEqual({ y: 1990, m: 1, d: 31 });
  });

  it('rejects malformed shapes and impossible dates', () => {
    expect(parseAnniversaryYmd('1990-13-01')).toBeNull();
    expect(parseAnniversaryYmd('1990-04-31')).toBeNull();
    expect(parseAnniversaryYmd('2023-02-29')).toBeNull();
    expect(parseAnniversaryYmd('1900-02-29')).toBeNull();
    expect(parseAnniversaryYmd('1990-1-1')).toBeNull();
    expect(parseAnniversaryYmd('not-a-date')).toBeNull();
    expect(parseAnniversaryYmd('')).toBeNull();
    expect(parseAnniversaryYmd(null)).toBeNull();
    expect(parseAnniversaryYmd(undefined)).toBeNull();
  });

  it('accepts 2000-02-29 (divisible by 400) and rejects 2100-02-29', () => {
    expect(parseAnniversaryYmd('2000-02-29')).not.toBeNull();
    expect(parseAnniversaryYmd('2100-02-29')).toBeNull();
  });
});

describe('computeNextAnniversaries: core semantics', () => {
  it('an anniversary today yields daysUntil 0 and stays in the result', () => {
    const result = compute([item({ date: '1990-10-24' })]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'birthday',
      refId: 'p-1',
      nextDate: '2026-10-24',
      daysUntil: 0,
      yearsCompleted: 36,
    });
  });

  it('a passed date this year rolls to next year and counts years from the source', () => {
    // Query near year end so the rolled date stays inside the 30-day window.
    const result = computeNextAnniversaries(
      [item({ date: '1980-01-10', refId: 'p-2' })],
      { y: 2026, m: 12, d: 20 },
      30,
    );
    expect(result[0]?.nextDate).toBe('2027-01-10');
    expect(result[0]?.daysUntil).toBe(21);
    expect(result[0]?.yearsCompleted).toBe(47);
  });

  it('the window is inclusive of days but exclusive beyond it', () => {
    const edge = item({ date: '1990-11-23', refId: 'edge' }); // exactly +30 days
    const beyond = item({ date: '1990-11-24', refId: 'beyond' }); // +31
    const result = compute([edge, beyond]);
    expect(result.map((entry) => entry.refId)).toEqual(['edge']);
  });

  it('merges birthdays and weddings into one ascending list', () => {
    const result = compute([
      item({ date: '1990-11-01', refId: 'b-late' }),
      item({ kind: 'wedding', refId: 'w:1:2', displayName: 'A & B', date: '2015-10-25' }),
      item({ date: '1970-10-26', refId: 'b-soon' }),
    ]);
    expect(result.map((entry) => entry.kind)).toEqual(['wedding', 'birthday', 'birthday']);
    expect(result.map((entry) => entry.daysUntil)).toEqual([1, 2, 8]);
  });

  it('tie-breaks equal daysUntil by older date first, then refId', () => {
    const result = compute([
      item({ date: '2000-10-24', refId: 'p-b' }), // same day, younger
      item({ date: '1980-11-23', refId: 'p-wed', kind: 'wedding' }), // +30, older date
      item({ date: '1990-11-23', refId: 'p-a' }), // +30, newer date
    ]);
    expect(result.map((entry) => entry.refId)).toEqual(['p-b', 'p-wed', 'p-a']);
  });

  it('drops broken dates silently while keeping valid siblings', () => {
    const result = compute([
      item({ date: '1990-02-30', refId: 'bad' }),
      item({ date: 'not-a-date', refId: 'worse' }),
      item({ date: '', refId: 'empty' }),
      item({ date: '1991-10-24', refId: 'good' }),
    ]);
    expect(result.map((entry) => entry.refId)).toEqual(['good']);
  });

  it('handles Feb 29: Mar 1 in a non-leap query year, Feb 29 in a leap year', () => {
    const leapling = item({ date: '1992-02-29', refId: 'leap' });
    const inLeapYear = computeNextAnniversaries([leapling], { y: 2028, m: 2, d: 20 }, 30);
    expect(inLeapYear[0]?.nextDate).toBe('2028-02-29');
    const inNonLeapYear = computeNextAnniversaries([leapling], { y: 2027, m: 2, d: 20 }, 30);
    expect(inNonLeapYear[0]?.nextDate).toBe('2027-03-01');
  });

  it('is deterministic regardless of input order', () => {
    const items = [
      item({ date: '1990-11-01', refId: 'a' }),
      item({ date: '1990-10-30', refId: 'b' }),
      item({ kind: 'wedding', date: '2015-10-25', refId: 'c', displayName: 'A & B' }),
    ];
    expect(compute(items)).toEqual(compute([...items].reverse()));
  });

  it('accepts a Date for now and reads it in UTC', () => {
    const result = computeNextAnniversaries([item({})], new Date('2026-10-24T00:30:00Z'), 30);
    expect(result[0]?.daysUntil).toBe(0);
    const shifted = computeNextAnniversaries([item({})], new Date('2026-10-24T23:30:00Z'), 30);
    expect(shifted[0]?.daysUntil).toBe(0);
  });

  it('returns an empty array for an empty input', () => {
    expect(compute([])).toEqual([]);
  });
});

describe('computeNextAnniversaries: kind haul v393', () => {
  it('kind haul memakai tanggal efektif yang diberikan pemanggil (haulOverrideDate sudah dipilih di upstream)', () => {
    const res = computeNextAnniversaries(
      [item({ kind: 'haul', refId: 'h1', date: '2018-11-15' })],
      { y: 2026, m: 10, d: 24 },
      30,
    );
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      kind: 'haul',
      refId: 'h1',
      nextDate: '2026-11-15',
      daysUntil: 22,
      yearsCompleted: 8,
    });
  });

  it('kind haul dengan tanggal deathDate (fallback upstream) berperilaku sama seperti anniversary tahunan', () => {
    const res = computeNextAnniversaries(
      [item({ kind: 'haul', refId: 'h2', date: '2020-05-10' })],
      { y: 2026, m: 5, d: 1 },
      30,
    );
    expect(res).toHaveLength(1);
    expect(res[0]?.nextDate).toBe('2026-05-10');
    expect(res[0]?.yearsCompleted).toBe(6);
  });

  it('rollover tahun: haul sudah lewat tahun ini bergulir ke tahun depan', () => {
    const res = computeNextAnniversaries(
      [item({ kind: 'haul', refId: 'h3', date: '2015-01-05' })],
      { y: 2026, m: 12, d: 20 },
      30,
    );
    expect(res).toHaveLength(1);
    expect(res[0]?.nextDate).toBe('2027-01-05');
    expect(res[0]?.yearsCompleted).toBe(12);
  });

  it('haul 29 Feb: 1 Mar pada tahun non-kabisat, 29 Feb pada tahun kabisat', () => {
    const haulLeap = item({ kind: 'haul', refId: 'hl', date: '2020-02-29' });
    const rLeap = computeNextAnniversaries([haulLeap], { y: 2028, m: 2, d: 1 }, 40);
    expect(rLeap[0]?.nextDate).toBe('2028-02-29');
    const rNonLeap = computeNextAnniversaries([haulLeap], { y: 2027, m: 2, d: 1 }, 40);
    expect(rNonLeap[0]?.nextDate).toBe('2027-03-01');
  });

  it('haul di luar jendela hari tidak masuk hasil', () => {
    const res = computeNextAnniversaries(
      [item({ kind: 'haul', refId: 'h4', date: '2000-12-31' })],
      { y: 2026, m: 10, d: 24 },
      30,
    );
    expect(res).toHaveLength(0);
  });

  it('determinisme urutan pada campuran birthday, wedding, dan haul di hari yang sama', () => {
    const list = [
      item({ kind: 'wedding', refId: 'w1', date: '2015-10-24', displayName: 'A & B' }),
      item({ kind: 'haul', refId: 'h1', date: '2010-10-24' }),
      item({ refId: 'b1', date: '1990-10-24' }),
    ];
    const res = compute(list);
    expect(res.map((e) => e.kind)).toEqual(['birthday', 'haul', 'wedding']);
    expect(compute(list)).toEqual(compute([...list].reverse()));
  });
});
