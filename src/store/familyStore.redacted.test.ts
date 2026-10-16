/**
 * v261-ii fase ii relationship privacy: hydrate aman payload redaksi.
 *
 * Kontrak v261-ii: min 12 kasus. hydrateMembers harus menerima campuran
 * payload penuh dan name-only, entri name-only di-hydrate jadi bentuk aman
 * render (birthDate string kosong, gender fallback other, maritalStatus
 * single), entri penuh tidak berubah perilaku (regresi).
 *
 * hydrateMembers diekspor untuk kebutuhan test.
 */

import { describe, it, expect } from 'vitest';
import { hydrateMembers } from './familyStore';
import type { FamilyMemberRecord, MemberRelationship } from '../lib/adapters';

describe('hydrateMembers redaksi (v261-ii)', () => {
  const TREE_ID = 't1';

  function full(overrides: Partial<FamilyMemberRecord> = {}): FamilyMemberRecord {
    return {
      id: 'm1',
      treeId: TREE_ID,
      name: 'Budi',
      birthDate: '1990-01-01',
      gender: 'male',
      isAlive: true,
      generation: 2,
      maritalStatus: 'single',
      ...overrides,
    } as FamilyMemberRecord;
  }

  function nameOnly(overrides: Record<string, unknown> = {}): FamilyMemberRecord {
    return {
      id: 'm2',
      treeId: TREE_ID,
      name: 'Siti',
      isAlive: true,
      generation: 2,
      gender: null,
      ...overrides,
    } as unknown as FamilyMemberRecord;
  }

  it('kasus 1: entri penuh utuh tanpa perubahan (regresi)', () => {
    const out = hydrateMembers([full()], []);
    expect(out).toHaveLength(1);
    expect(out[0].birthDate).toBe('1990-01-01');
    expect(out[0].gender).toBe('male');
    expect(out[0].maritalStatus).toBe('single');
  });

  it('kasus 2: entri name-only hydrate aman birthDate string kosong', () => {
    const out = hydrateMembers([nameOnly()], []);
    expect(out[0].birthDate).toBe('');
  });

  it('kasus 3: gender null fallback other', () => {
    const out = hydrateMembers([nameOnly()], []);
    expect(out[0].gender).toBe('other');
  });

  it('kasus 4: maritalStatus undefined fallback single', () => {
    const out = hydrateMembers([nameOnly()], []);
    expect(out[0].maritalStatus).toBe('single');
  });

  it('kasus 5: generation null hydrate 0 aman render', () => {
    const out = hydrateMembers([nameOnly({ generation: null })], []);
    expect(out[0].generation).toBe(0);
  });

  it('kasus 6: nama dan isAlive tetap eksak pada name-only', () => {
    const out = hydrateMembers([nameOnly({ name: 'Dewi Rahayu', isAlive: false })], []);
    expect(out[0].name).toBe('Dewi Rahayu');
    expect(out[0].isAlive).toBe(false);
  });

  it('kasus 7: campuran full + name-only jumlah baris sesuai', () => {
    const out = hydrateMembers([full(), nameOnly()], []);
    expect(out).toHaveLength(2);
  });

  it('kasus 8: campuran relasi spouse lintas full dan name-only', () => {
    const rels: MemberRelationship[] = [
      { id: 'r1', treeId: TREE_ID, memberId: 'm1', relatedId: 'm2', type: 'spouse' },
    ];
    const out = hydrateMembers([full(), nameOnly()], rels);
    expect(out[0].spouseIds).toEqual(['m2']);
    expect(out[1].spouseIds).toEqual(['m1']);
  });

  it('kasus 9: relasi parent name-only sebagai anak', () => {
    const rels: MemberRelationship[] = [
      { id: 'r1', treeId: TREE_ID, memberId: 'm2', relatedId: 'm1', type: 'parent' },
    ];
    const out = hydrateMembers([full(), nameOnly()], rels);
    expect(out[0].parentIds).toEqual(['m2']);
    expect(out[1].childrenIds).toEqual(['m1']);
  });

  it('kasus 10: relasi sibling name-only (semantik existing satu arah: sisi memberId)', () => {
    const rels: MemberRelationship[] = [
      { id: 'r1', treeId: TREE_ID, memberId: 'm2', relatedId: 'm1', type: 'sibling' },
    ];
    const out = hydrateMembers([full(), nameOnly()], rels);
    expect(out[1].siblingIds).toEqual(['m1']);
    expect(out[0].siblingIds).toBeUndefined();
  });

  it('kasus 11: record penuh dengan rel ganda spouse dedup urut', () => {
    const rels: MemberRelationship[] = [
      { id: 'r1', treeId: TREE_ID, memberId: 'm1', relatedId: 'm2', type: 'spouse' },
      { id: 'r2', treeId: TREE_ID, memberId: 'm2', relatedId: 'm1', type: 'spouse' },
    ];
    const out = hydrateMembers([full(), nameOnly()], rels);
    expect(out[0].spouseIds).toEqual(['m2']);
    expect(out[1].spouseIds).toEqual(['m1']);
  });

  it('kasus 12: privacyStatus name-only tidak crash saat hydrate', () => {
    const out = hydrateMembers([nameOnly({ privacyStatus: 'private' })], []);
    expect(out[0].name).toBe('Siti');
  });

  it('kasus 13: hubungan sibling dua arah name-only kedua sisi', () => {
    const rels: MemberRelationship[] = [
      { id: 'r1', treeId: TREE_ID, memberId: 'm1', relatedId: 'm2', type: 'sibling' },
      { id: 'r2', treeId: TREE_ID, memberId: 'm2', relatedId: 'm1', type: 'sibling' },
    ];
    const out = hydrateMembers([full(), nameOnly()], rels);
    expect(out[0].siblingIds).toEqual(['m2']);
    expect(out[1].siblingIds).toEqual(['m1']);
  });

  it('kasus 14: nama panjang dan karakter unicode aman', () => {
    const out = hydrateMembers([nameOnly({ name: 'Ö Üñíçødé Yang Panjang' })], []);
    expect(out[0].name).toBe('Ö Üñíçødé Yang Panjang');
  });
});
