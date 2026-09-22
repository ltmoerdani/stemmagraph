/**
 * @vitest-environment jsdom
 *
 * GOAL v143-i: hook useKinshipGraph sebagai jembatan store ke
 * KinshipGraph. useFamilyStore di-mock via vi.mock dengan state
 * fixture (pola KinshipPanelMount.test.tsx v141). Hook diuji sebagai
 * pure data: pemetaan spouse/parent, duplikasi, memoisasi, dan
 * penerusan selectedMember.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../types/family';
import type { MemberRelationship } from '../lib/adapters';
import { useKinshipGraph } from './useKinshipGraph';

interface FixtureState {
  members: FamilyMember[];
  relationships: MemberRelationship[];
  selectedMember: FamilyMember | null;
}

const { mockState } = vi.hoisted(() => ({
  mockState: {
    state: {
      members: [],
      relationships: [],
      selectedMember: null,
    } as unknown as Record<string, unknown>,
  },
}));

vi.mock('../store/familyStore', () => ({
  useFamilyStore: (sel: (s: FixtureState) => unknown) =>
    sel(mockState.state as unknown as FixtureState),
}));

function member(id: string, name: string): FamilyMember {
  return { id, name } as unknown as FamilyMember;
}

function rel(
  id: string,
  memberId: string,
  relatedId: string,
  type: MemberRelationship['type'],
): MemberRelationship {
  return { id, treeId: 't1', memberId, relatedId, type };
}

function setState(
  members: FamilyMember[],
  relationships: MemberRelationship[],
  selectedMember: FamilyMember | null,
): void {
  mockState.state = { members, relationships, selectedMember };
}

function renderKinship() {
  return renderHook(() => useKinshipGraph());
}

afterEach(cleanup);

describe('useKinshipGraph', () => {
  it('graph kosong saat members kosong', () => {
    setState([], [], null);
    const { result } = renderKinship();
    expect(result.current.graph.partners.size).toBe(0);
    expect(result.current.graph.parentsOf('A')).toEqual([]);
    expect(result.current.graph.childrenOf('A')).toEqual([]);
    expect(result.current.graph.siblingsOf('A')).toEqual([]);
  });

  it('spouse dipetakan partner link dua arah', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], null);
    const { result } = renderKinship();
    expect(result.current.graph.partners.get('A')).toEqual(['B']);
    expect(result.current.graph.partners.get('B')).toEqual(['A']);
  });

  it('parent dipetakan ChildLink benar arah', () => {
    const A = member('A', 'Andi');
    const C = member('C', 'Citra');
    // Konvensi store: memberId orang tua, relatedId anak.
    setState([A, C], [rel('r1', 'A', 'C', 'parent')], null);
    const { result } = renderKinship();
    expect(result.current.graph.parentsOf('C')).toEqual(['A']);
    expect(result.current.graph.childrenOf('A')).toEqual(['C']);
    expect(result.current.graph.parentsOf('A')).toEqual([]);
  });

  it('duplikat link tidak dobel', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    const C = member('C', 'Citra');
    setState(
      [A, B, C],
      [
        rel('r1', 'A', 'B', 'spouse'),
        rel('r2', 'A', 'B', 'spouse'),
        rel('r3', 'B', 'C', 'parent'),
        rel('r4', 'B', 'C', 'parent'),
      ],
      null,
    );
    const { result } = renderKinship();
    expect(result.current.graph.partners.get('A')).toEqual(['B']);
    expect(result.current.graph.parentsOf('C')).toEqual(['B']);
    expect(result.current.graph.childrenOf('B')).toEqual(['C']);
  });

  it('memo stabil antar render bila input sama', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], A);
    const { result, rerender } = renderKinship();
    const first = result.current;
    rerender();
    expect(result.current.graph).toBe(first.graph);
    expect(result.current.selectedMember).toBe(first.selectedMember);
  });

  it('graph terubah saat relationships berubah', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    setState([A, B], [], null);
    const { result, rerender } = renderKinship();
    expect(result.current.graph.partners.get('A')).toBeUndefined();
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], null);
    rerender();
    expect(result.current.graph.partners.get('A')).toEqual(['B']);
  });

  it('selectedMember diteruskan', () => {
    const A = member('A', 'Andi');
    setState([A], [], A);
    const { result } = renderKinship();
    expect(result.current.selectedMember).toBe(A);
    expect(result.current.selectedMember?.id).toBe('A');
  });

  it('null selectedMember diteruskan', () => {
    const A = member('A', 'Andi');
    setState([A], [], null);
    const { result } = renderKinship();
    expect(result.current.selectedMember).toBeNull();
  });

  it('urutan insertion stabil deterministik', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    const C = member('C', 'Citra');
    const rels = [
      rel('r1', 'A', 'C', 'parent'),
      rel('r2', 'B', 'C', 'parent'),
    ];
    setState([A, B, C], rels, null);
    const { result } = renderKinship();
    expect(result.current.graph.parentsOf('C')).toEqual(['A', 'B']);
    // Input sama dipanggil ulang menghasilkan urutan identik.
    setState([A, B, C], [...rels], null);
    const first = result.current.graph;
    const { result: second } = renderKinship();
    expect(second.current.graph.parentsOf('C')).toEqual(
      first.parentsOf('C'),
    );
  });

  it('id yang tidak ada di members tetap aman', () => {
    const A = member('A', 'Andi');
    // Rel menunjuk id 'X' yang tidak terdaftar sebagai member.
    setState(
      [A],
      [
        rel('r1', 'A', 'X', 'parent'),
        rel('r2', 'X', 'A', 'spouse'),
      ],
      null,
    );
    const { result } = renderKinship();
    expect(() => result.current.graph.parentsOf('X')).not.toThrow();
    expect(result.current.graph.parentsOf('X')).toEqual([]);
    expect(result.current.graph.childrenOf('A')).toEqual([]);
    expect(result.current.graph.partners.get('A')).toEqual(['X']);
  });
});
