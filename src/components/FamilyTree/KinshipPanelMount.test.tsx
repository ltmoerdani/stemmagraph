/**
 * @vitest-environment jsdom
 *
 * GOAL v141-i: mount KinshipPanel ke store keluarga.
 * useFamilyStore di-mock via vi.mock dengan state fixture sehingga
 * komponen diuji sebagai pure bridge store ke panel. Pola render
 * mengikuti KinshipPanel.test.tsx: graph lewat buildKinshipGraph,
 * react-i18next di-mock minimal untuk memilih locale id/en.
 *
 * GOAL v143-ii: mount mendelegasikan pembangunan graph ke hook
 * useKinshipGraph. Kasus baru memverifikasi delegasi via override
 * hook (importOriginal) tanpa mengubah asersi perilaku render.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../types/family';
import type { MemberRelationship } from '../../lib/adapters';
import { buildKinshipGraph } from '../../lib/genealogy/kinship';
import { makePartnerRelation } from '../../lib/genealogy/relationship';
import { KinshipPanelMount } from './KinshipPanelMount';

interface FixtureState {
  members: FamilyMember[];
  relationships: MemberRelationship[];
  selectedMember: FamilyMember | null;
}

const { mockState, hookOverride } = vi.hoisted(() => ({
  mockState: {
    language: 'id',
    state: {
      members: [],
      relationships: [],
      selectedMember: null,
    } as unknown as Record<string, unknown>,
  },
  hookOverride: {
    value: null as null | {
      graph: ReturnType<typeof buildKinshipGraph>;
      selectedMember: FamilyMember | null;
    },
  },
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (sel: (s: FixtureState) => unknown) =>
    sel(mockState.state as unknown as FixtureState),
}));

vi.mock('../../hooks/useKinshipGraph', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../hooks/useKinshipGraph')
  >();
  return {
    useKinshipGraph: () =>
      hookOverride.value ?? actual.useKinshipGraph(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockState.language } }),
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

beforeEach(() => {
  mockState.language = 'id';
  hookOverride.value = null;
});

afterEach(cleanup);

describe('KinshipPanelMount', () => {
  it('render null tanpa selectedMember', () => {
    const A = member('A', 'Andi');
    setState([A], [], null);
    const { container } = render(<KinshipPanelMount />);
    expect(container.innerHTML).toBe('');
  });

  it('render panel untuk selectedMember dengan label pasangan (id)', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], A);
    render(<KinshipPanelMount />);
    expect(screen.getByLabelText('kinship')).toBeTruthy();
    expect(screen.getByText(/^pasangan/)).toBeTruthy();
  });

  it('spouse ganda tampil dua baris pasangan', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    const C = member('C', 'Citra');
    setState(
      [A, B, C],
      [rel('r1', 'A', 'B', 'spouse'), rel('r2', 'A', 'C', 'spouse')],
      A,
    );
    render(<KinshipPanelMount />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText(/^pasangan/)).toHaveLength(2);
  });

  it('rel parent: anak melihat label orang tua', () => {
    const P = member('P', 'Pak Botak');
    const C = member('C', 'Cici');
    setState([P, C], [rel('r1', 'P', 'C', 'parent')], C);
    render(<KinshipPanelMount />);
    expect(screen.getByText(/^orang tua/)).toBeTruthy();
  });

  it('rel parent: orang tua melihat label anak', () => {
    const P = member('P', 'Pak Botak');
    const C = member('C', 'Cici');
    setState([P, C], [rel('r1', 'P', 'C', 'parent')], P);
    render(<KinshipPanelMount />);
    expect(screen.getByText(/^anak/)).toBeTruthy();
  });

  it('getPersonName memakai nama member dari store', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi Santoso');
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], A);
    render(<KinshipPanelMount />);
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
  });

  it('graph kosong tanpa relasi tidak crash', () => {
    const X = member('X', 'Xena');
    setState([X], [], X);
    render(<KinshipPanelMount />);
    expect(screen.getByText('tidak ada hubungan lain')).toBeTruthy();
  });

  it('locale en menghasilkan label english', () => {
    mockState.language = 'en';
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    setState([A, B], [rel('r1', 'A', 'B', 'spouse')], A);
    render(<KinshipPanelMount />);
    expect(screen.getByText(/^spouse/)).toBeTruthy();
  });

  it('saudara tampil untuk anak yang berbagi orang tua', () => {
    const P = member('P', 'Pak Botak');
    const C1 = member('C1', 'Cici');
    const C2 = member('C2', 'Coco');
    setState(
      [P, C1, C2],
      [rel('r1', 'P', 'C1', 'parent'), rel('r2', 'P', 'C2', 'parent')],
      C1,
    );
    render(<KinshipPanelMount />);
    expect(screen.getByText(/^saudara/)).toBeTruthy();
    expect(screen.getByText('Coco')).toBeTruthy();
  });

  it('delegasi hook: graph dari useKinshipGraph dipakai panel (v143-ii)', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    const graph = buildKinshipGraph(
      ['A', 'B'],
      [makePartnerRelation('A', 'B')],
      [],
    );
    setState([A, B], [], A);
    hookOverride.value = { graph, selectedMember: A };
    render(<KinshipPanelMount />);
    expect(screen.getByLabelText('kinship')).toBeTruthy();
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.getByText(/^pasangan/)).toBeTruthy();
  });

  it('delegasi hook: selectedMember dari hook jadi fromId panel (v143-ii)', () => {
    const A = member('A', 'Andi');
    const B = member('B', 'Budi');
    const graph = buildKinshipGraph(
      ['A', 'B'],
      [makePartnerRelation('A', 'B')],
      [],
    );
    setState([A, B], [], B);
    hookOverride.value = { graph, selectedMember: B };
    render(<KinshipPanelMount />);
    expect(screen.getByText('Andi')).toBeTruthy();
    expect(screen.getByText(/^pasangan/)).toBeTruthy();
  });
});
