import { describe, expect, it } from 'vitest';
import { exportGedcom70 } from './exportGedcom70';
import type { Member } from '../types';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    name: { given: 'Budi', surname: 'Santoso' },
    gender: 'M',
    birthDate: '1970-01-01',
    birthPlace: undefined,
    deathDate: undefined,
    deathPlace: undefined,
    ...overrides,
  };
}

describe('exportGedcom70 BIRT PLAC wiring', () => {
  it('trims surrounding whitespace from birthPlace', () => {
    const out = exportGedcom70([makeMember({ birthPlace: '  Surabaya  ' })]);
    expect(out).toContain('2 PLAC Surabaya');
  });

  it('omits PLAC line when birthPlace is empty string', () => {
    const out = exportGedcom70([makeMember({ birthPlace: '' })]);
    expect(out).not.toContain('2 PLAC');
  });

  it('collapses internal tabs to a single space', () => {
    const out = exportGedcom70([makeMember({ birthPlace: 'Surabaya\tJawa Timur' })]);
    expect(out).toContain('2 PLAC Surabaya Jawa Timur');
  });
});
