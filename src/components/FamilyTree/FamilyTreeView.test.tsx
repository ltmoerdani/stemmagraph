/**
 * @vitest-environment jsdom
 *
 * GOAL v141-ii: wiring KinshipPanelMount ke FamilyTreeView.
 * useFamilyStore dan semua child component di-mock sehingga FamilyTreeView
 * diuji sebagai pure wiring: kondisional viewMode tetap, KinshipPanelMount
 * ter-mount di akhir container pada semua view mode. Pola mock store
 * mengikuti KinshipPanelMount.test.tsx (vi.hoisted + vi.mock).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../types/family';
import { FamilyTreeView } from './FamilyTreeView';

interface FixtureState {
  viewMode: { type: string };
  selectedMember: FamilyMember | null;
}

const { mockState, treeSpy } = vi.hoisted(() => ({
  mockState: {
    state: {
      viewMode: { type: 'tree' },
      selectedMember: null,
    } as unknown as Record<string, unknown>,
  },
  treeSpy: vi.fn(),
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (sel?: (s: FixtureState) => unknown) =>
    sel
      ? sel(mockState.state as unknown as FixtureState)
      : (mockState.state as unknown as FixtureState),
}));

vi.mock('./ReactFlowTreeView', () => ({
  ReactFlowTreeView: () => {
    treeSpy();
    return <div data-testid="tree-view" />;
  },
}));

vi.mock('./CardView', () => ({
  CardView: () => <div data-testid="card-view" />,
}));

vi.mock('./ListView', () => ({
  ListView: () => <div data-testid="list-view" />,
}));

vi.mock('./KinshipPanelMount', () => ({
  KinshipPanelMount: () => <div data-testid="kinship-mount" />,
}));

function member(id: string, name: string): FamilyMember {
  return { id, name } as unknown as FamilyMember;
}

function setState(viewMode: string, selectedMember: FamilyMember | null): void {
  mockState.state = { viewMode: { type: viewMode }, selectedMember };
}

beforeEach(() => {
  treeSpy.mockClear();
});

afterEach(cleanup);

describe('FamilyTreeView wiring KinshipPanelMount', () => {
  it('viewMode tree: ReactFlowTreeView tampil dan KinshipPanelMount ter-mount tanpa crash', () => {
    setState('tree', null);
    render(<FamilyTreeView />);
    expect(screen.getByTestId('tree-view')).toBeTruthy();
    expect(screen.getByTestId('kinship-mount')).toBeTruthy();
  });

  it('viewMode card: CardView tampil dan KinshipPanelMount ter-mount tanpa crash', () => {
    setState('card', null);
    render(<FamilyTreeView />);
    expect(screen.getByTestId('card-view')).toBeTruthy();
    expect(screen.getByTestId('kinship-mount')).toBeTruthy();
  });

  it('viewMode list: ListView tampil dan KinshipPanelMount ter-mount tanpa crash', () => {
    setState('list', null);
    render(<FamilyTreeView />);
    expect(screen.getByTestId('list-view')).toBeTruthy();
    expect(screen.getByTestId('kinship-mount')).toBeTruthy();
  });

  it('KinshipPanelMount ada di dokumen pada semua view mode', () => {
    for (const mode of ['tree', 'card', 'list']) {
      setState(mode, null);
      const { unmount } = render(<FamilyTreeView />);
      expect(screen.getByTestId('kinship-mount')).toBeTruthy();
      unmount();
    }
  });

  it('regression: kondisional viewMode tetap, ReactFlowTreeView terpanggil saat tree', () => {
    setState('tree', null);
    render(<FamilyTreeView />);
    expect(treeSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('card-view')).toBeNull();
    expect(screen.queryByTestId('list-view')).toBeNull();
  });

  it('render ulang dengan selectedMember berubah tidak crash', () => {
    setState('tree', null);
    const { rerender } = render(<FamilyTreeView />);
    setState('tree', member('A', 'Andi'));
    rerender(<FamilyTreeView />);
    expect(screen.getByTestId('tree-view')).toBeTruthy();
    expect(screen.getByTestId('kinship-mount')).toBeTruthy();
  });
});
