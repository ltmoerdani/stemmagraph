/**
 * Test modul pure mergeMembers (v390 fase 1).
 * Cakupan: cycle guard, rewire dua arah, dedup baris ganda, edge
 * internal primary<->duplicate, reassign facts passthrough.
 */
import { describe, it, expect } from 'vitest';
import {
  isParentChildConnected,
  planRelationshipRewire,
  planEventReassign,
} from './mergeMembers';

describe('isParentChildConnected (guard cycle parent-child)', () => {
  const rels = [
    { id: 'r1', memberId: 'A', relatedId: 'B', type: 'parent' }, // A orang tua B
    { id: 'r2', memberId: 'C', relatedId: 'B', type: 'child' }, // C anak dari B
    { id: 'r3', memberId: 'X', relatedId: 'Y', type: 'spouse' }, // tidak relevan
  ];

  it('leluhur langsung terdeteksi', () => {
    expect(isParentChildConnected('B', 'A', rels)).toBe(true);
  });

  it('turunan langsung terdeteksi', () => {
    expect(isParentChildConnected('A', 'B', rels)).toBe(true);
  });

  it('leluhur multi-hop terdeteksi (cucu)', () => {
    const chain = [
      { id: 'c1', memberId: 'G1', relatedId: 'G2', type: 'parent' },
      { id: 'c2', memberId: 'G2', relatedId: 'G3', type: 'parent' },
    ];
    expect(isParentChildConnected('G1', 'G3', chain)).toBe(true);
  });

  it('spouse saja tidak dianggap koneksi parent-child', () => {
    expect(isParentChildConnected('X', 'Y', rels)).toBe(false);
  });

  it('tanpa relasi sama sekali nihil koneksi', () => {
    expect(isParentChildConnected('P', 'Q', [])).toBe(false);
  });
});

describe('planRelationshipRewire (v390)', () => {
  it('rewire relasi dari sisi memberId duplikat', () => {
    const rels = [
      { id: 'r1', memberId: 'D', relatedId: 'W', type: 'spouse' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual(['r1']);
    expect(plan.delete).toEqual([]);
  });

  it('rewire relasi dari sisi relatedId duplikat', () => {
    const rels = [
      { id: 'r2', memberId: 'W', relatedId: 'D', type: 'parent' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual(['r2']);
    expect(plan.delete).toEqual([]);
  });

  it('edge internal primary<->duplicate dihapus', () => {
    const rels = [
      { id: 'r3', memberId: 'P', relatedId: 'D', type: 'spouse' },
      { id: 'r4', memberId: 'D', relatedId: 'P', type: 'child' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual([]);
    expect(plan.delete).toEqual(['r3', 'r4']);
  });

  it('baris ganda pasca rewire dihapus (dedup)', () => {
    // D->W spouse dan P->W spouse: setelah rewire, D->W jadi P->W yang
    // identik dengan baris existing P->W, jadi baris rewire dihapus.
    const rels = [
      { id: 'r5', memberId: 'D', relatedId: 'W', type: 'spouse' },
      { id: 'r6', memberId: 'P', relatedId: 'W', type: 'spouse' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual([]);
    expect(plan.delete).toEqual(['r5']);
  });

  it('dedup simetris: duplikat sisi relatedId menghasilkan kunci sama', () => {
    const rels = [
      { id: 'r7', memberId: 'W', relatedId: 'D', type: 'spouse' },
      { id: 'r8', memberId: 'W', relatedId: 'P', type: 'spouse' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual([]);
    expect(plan.delete).toEqual(['r7']);
  });

  it('tanpa relasi yang menyentuh duplikat nihil rencana', () => {
    const rels = [
      { id: 'r9', memberId: 'A', relatedId: 'B', type: 'parent' },
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire).toEqual([]);
    expect(plan.delete).toEqual([]);
  });

  it('beberapa relasi campuran konsisten', () => {
    const rels = [
      { id: 'a1', memberId: 'D', relatedId: 'W', type: 'spouse' },
      { id: 'a2', memberId: 'K', relatedId: 'D', type: 'parent' },
      { id: 'a3', memberId: 'D', relatedId: 'K', type: 'child' }, // ganda pasca rewire a2
      { id: 'a4', memberId: 'P', relatedId: 'W', type: 'spouse' }, // sudah ada, a1 ganda
      { id: 'a5', memberId: 'P', relatedId: 'D', type: 'spouse' }, // edge internal
    ];
    const plan = planRelationshipRewire('D', 'P', rels);
    expect(plan.rewire.sort()).toEqual(['a2']);
    expect(plan.delete.sort()).toEqual(['a1', 'a3', 'a5']);
  });
});

describe('planEventReassign (v390)', () => {
  it('semua event duplikat dipindah tanpa penghapusan', () => {
    const events = [
      { id: 'e1', memberId: 'D', type: 'BIRT' },
      { id: 'e2', memberId: 'D', type: 'MARR' },
    ];
    expect(planEventReassign(events)).toEqual(['e1', 'e2']);
  });

  it('tanpa event nihil rencana', () => {
    expect(planEventReassign([])).toEqual([]);
  });
});
