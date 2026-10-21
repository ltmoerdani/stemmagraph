import { describe, expect, it } from 'vitest';
import {
  computeMissingEventGaps,
  type PersonRecord,
} from './missing-event-gaps';

function person(overrides: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id: 'p1',
    birthDate: '1900-01-01',
    birthPlace: 'Bandung',
    deathDate: '1980-05-05',
    ...overrides,
  };
}

describe('computeMissingEventGaps', () => {
  it('kasus 1: records kosong menghasilkan 4 baris value 0 total 0 tanpa throw', () => {
    const result = computeMissingEventGaps([]);
    expect(result.rows).toHaveLength(4);
    for (const row of result.rows) {
      expect(row.value).toBe(0);
      expect(row.total).toBe(0);
    }
  });

  it('kasus 2: semua lengkap menghasilkan value 0 di semua baris', () => {
    const result = computeMissingEventGaps([
      person(),
      person({ id: 'p2' }),
    ]);
    expect(result.rows.every((row) => row.value === 0)).toBe(true);
    expect(result.rows.every((row) => row.total === 2)).toBe(true);
  });

  it('kasus 3: semua kosong menghasilkan value sama dengan total', () => {
    const result = computeMissingEventGaps([
      person({ id: 'p1', birthDate: null, birthPlace: null, deathDate: null }),
      person({ id: 'p2', birthDate: null, birthPlace: null, deathDate: null }),
      person({ id: 'p3', birthDate: null, birthPlace: null, deathDate: null }),
    ]);
    expect(result.rows[0]).toEqual({ event: 'BIRT', kind: 'event', value: 3, total: 3 });
    expect(result.rows[1]).toEqual({ event: 'BIRT', kind: 'place', value: 3, total: 3 });
    expect(result.rows[2]).toEqual({ event: 'DEAT', kind: 'event', value: 3, total: 3 });
    expect(result.rows[3]).toEqual({ event: 'DEAT', kind: 'place', value: 0, total: 3 });
  });

  it('kasus 4: campuran dihitung benar per event', () => {
    const result = computeMissingEventGaps([
      person(),
      person({ id: 'p2', birthDate: null, deathDate: null }),
      person({ id: 'p3', birthPlace: null }),
    ]);
    expect(result.rows[0]).toMatchObject({ value: 1, total: 3 });
    expect(result.rows[1]).toMatchObject({ value: 1, total: 3 });
    expect(result.rows[2]).toMatchObject({ value: 1, total: 3 });
  });

  it('kasus 5: birthDate spasi dianggap missing', () => {
    const result = computeMissingEventGaps([person({ birthDate: '   ' })]);
    expect(result.rows[0].value).toBe(1);
  });

  it('kasus 6: birthDate terisi tidak dianggap missing', () => {
    const result = computeMissingEventGaps([person({ birthDate: '1875-03-21' })]);
    expect(result.rows[0].value).toBe(0);
  });

  it('kasus 7: birthPlace null vs spasi vs terisi', () => {
    const result = computeMissingEventGaps([
      person({ id: 'p1', birthPlace: null }),
      person({ id: 'p2', birthPlace: '  ' }),
      person({ id: 'p3', birthPlace: 'Surabaya' }),
    ]);
    expect(result.rows[1].value).toBe(2);
    expect(result.rows[1].total).toBe(3);
  });

  it('kasus 8: DEAT placeMissing selalu 0 walau data lain kosong', () => {
    const result = computeMissingEventGaps([
      person({ id: 'p1', birthDate: null, birthPlace: null, deathDate: null }),
      person({ id: 'p2', birthDate: ' ' }),
    ]);
    expect(result.rows[3]).toEqual({ event: 'DEAT', kind: 'place', value: 0, total: 2 });
  });

  it('kasus 9: urutan rows tetap BIRT-event, BIRT-place, DEAT-event, DEAT-place', () => {
    const result = computeMissingEventGaps([person()]);
    expect(result.rows.map((row) => `${row.event}-${row.kind}`)).toEqual([
      'BIRT-event',
      'BIRT-place',
      'DEAT-event',
      'DEAT-place',
    ]);
  });

  it('kasus 10: id kosong melempar Error ber-index', () => {
    expect(() => computeMissingEventGaps([person({ id: '' })])).toThrowError(
      /missing-event-gaps: record index 0/,
    );
  });

  it('kasus 11: birthDate number melempar Error ber-index', () => {
    expect(() =>
      computeMissingEventGaps([person({ id: 'p9' }), person({ birthDate: 1900 as unknown as string })]),
    ).toThrowError(/missing-event-gaps: record index 1 birthDate/);
  });

  it('kasus 12: birthPlace boolean melempar Error ber-index', () => {
    expect(() =>
      computeMissingEventGaps([person({ birthPlace: true as unknown as string })]),
    ).toThrowError(/missing-event-gaps: record index 0 birthPlace/);
  });

  it('kasus 13: records bukan array melempar Error prefiks missing-event-gaps', () => {
    expect(() =>
      computeMissingEventGaps('bukan-array' as unknown as PersonRecord[]),
    ).toThrowError(/missing-event-gaps: records harus array/);
  });

  it('kasus 14: entri bukan objek melempar Error ber-index', () => {
    expect(() =>
      computeMissingEventGaps([person(), null as unknown as PersonRecord]),
    ).toThrowError(/missing-event-gaps: record index 1 bukan objek/);
  });

  it('kasus 15: determinisme, input sama dipanggil dua kali output identik deep equal', () => {
    const input: PersonRecord[] = [
      person({ id: 'p1', birthDate: null }),
      person({ id: 'p2', deathDate: ' ', birthPlace: null }),
      person({ id: 'p3' }),
    ];
    const first = computeMissingEventGaps(input);
    const second = computeMissingEventGaps(input);
    expect(second).toEqual(first);
  });
});
