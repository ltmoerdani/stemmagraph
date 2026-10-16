/**
 * v261-ii fase ii relationship privacy: guard redaksi di lapis adapter.
 *
 * Kontrak v261-ii: min 12 kasus. Fokus: payload name-only (6 field) dari
 * read path v261-i dikenali guard isNameOnlyMember, payload penuh utuh,
 * field opsional undefined tidak crash, hidden tetap null, campuran aman.
 * Modul yang diuji murni, NOL mock network.
 */

import { describe, it, expect } from 'vitest';
import {
  isNameOnlyMember,
  type RedactedMemberPayload,
} from '../../types/redacted';
import type { FamilyMemberRecord } from './types';

function fullRecord(overrides: Partial<FamilyMemberRecord> = {}): FamilyMemberRecord {
  return {
    id: 'm-full',
    treeId: 't1',
    name: 'Budi Santoso',
    birthDate: '1990-01-01',
    gender: 'male',
    isAlive: true,
    generation: 2,
    maritalStatus: 'single',
    ...overrides,
  };
}

function nameOnly(overrides: Partial<Record<string, unknown>> = {}): RedactedMemberPayload {
  return {
    id: 'm-name',
    treeId: 't1',
    name: 'Siti (terbatas)',
    isAlive: true,
    generation: 2,
    gender: null,
    ...overrides,
  } as RedactedMemberPayload;
}

describe('isNameOnlyMember guard (v261-ii)', () => {
  it('kasus 1: payload penuh TIDAK dikenali name-only', () => {
    expect(isNameOnlyMember(fullRecord())).toBe(false);
  });

  it('kasus 2: payload name-only 6 field dikenali guard', () => {
    const p = nameOnly();
    expect(isNameOnlyMember(p)).toBe(true);
  });

  it('kasus 3: null ditolak guard tanpa crash', () => {
    expect(isNameOnlyMember(null as unknown as RedactedMemberPayload)).toBe(false);
  });

  it('kasus 4: undefined ditolak guard tanpa crash', () => {
    expect(isNameOnlyMember(undefined as unknown as RedactedMemberPayload)).toBe(false);
  });

  it('kasus 5: birthDate hadir meski null => bukan name-only (ada kunci)', () => {
    const p = nameOnly({ birthDate: null });
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 6: birthDate string kosong => bukan name-only (hadir)', () => {
    const p = nameOnly({ birthDate: '' });
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 7: kunci generation absen => bukan name-only', () => {
    const p = nameOnly();
    delete (p as Record<string, unknown>).generation;
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 8: kunci gender absen => bukan name-only', () => {
    const p = nameOnly();
    delete (p as Record<string, unknown>).gender;
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 9: field opsional record penuh undefined nihil crash', () => {
    const r = fullRecord({ nickname: undefined, photoUrl: undefined, email: undefined });
    expect(isNameOnlyMember(r)).toBe(false);
    expect(r.nickname).toBeUndefined();
  });

  it('kasus 10: name-only dengan generation null tetap dikenali', () => {
    const p = nameOnly({ generation: null });
    expect(isNameOnlyMember(p)).toBe(true);
  });

  it('kasus 11: name-only gender non-string (angka) => guard tetap terbaca sbg name-only bila struktur kunci cocok', () => {
    const p = nameOnly({ gender: 7 });
    expect(isNameOnlyMember(p)).toBe(true);
  });

  it('kasus 12: isAlive non-boolean => bukan name-only', () => {
    const p = nameOnly({ isAlive: 'yes' });
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 13: id non-string => bukan name-only', () => {
    const p = nameOnly({ id: 42 });
    expect(isNameOnlyMember(p)).toBe(false);
  });

  it('kasus 14: campuran list full + name-only dipilah guard konsisten', () => {
    const list = [fullRecord(), nameOnly(), fullRecord({ id: 'm-full-2' })];
    const flags = list.map(isNameOnlyMember);
    expect(flags).toEqual([false, true, false]);
  });
});
