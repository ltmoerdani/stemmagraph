/**
 * @vitest-environment jsdom
 *
 * GOAL v140 fase ii: wiring panel hubungan kekerabatan ke UI.
 * Graph uji dibangun manual via ChildLink/partners, pola sama
 * dengan src/lib/genealogy/kinship-calc.test.ts.
 * react-i18next di-mock minimal: hanya i18n.language yang dipakai
 * komponen untuk memilih locale id/en.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import { makePartnerRelation } from '../../lib/genealogy/relationship';
import { KinshipPanel } from './KinshipPanel';

const { mockState } = vi.hoisted(() => ({
  mockState: { language: 'id' },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockState.language } }),
}));

function link(childId: string, parentId: string): ChildLink {
  return { childId, parentId, type: 'BIRTH' };
}

/** Rantai tiga generasi: P1 tua P2, P2 tua P3. */
function chainGraph(): KinshipGraph {
  return buildKinshipGraph(['P1', 'P2', 'P3'], [], [link('P2', 'P1'), link('P3', 'P2')]);
}

function partnerGraph(): KinshipGraph {
  return buildKinshipGraph(['A', 'B'], [makePartnerRelation('A', 'B')], []);
}

beforeEach(() => {
  mockState.language = 'id';
});

afterEach(cleanup);

describe('KinshipPanel', () => {
  it('label id default: pasangan tampil dalam bahasa Indonesia', () => {
    render(<KinshipPanel graph={partnerGraph()} fromId="A" />);
    expect(screen.getByText(/^pasangan/)).toBeTruthy();
  });

  it('label en saat i18n.language berubah ke en', () => {
    mockState.language = 'en';
    render(<KinshipPanel graph={partnerGraph()} fromId="A" />);
    expect(screen.getByText(/^spouse/)).toBeTruthy();
  });

  it('depth tampil kata generasi (id) untuk grandparent', () => {
    render(<KinshipPanel graph={chainGraph()} fromId="P3" />);
    expect(screen.getByText('kakek nenek (2 generasi)')).toBeTruthy();
  });

  it('depth tampil kata generations (en) untuk grandparent', () => {
    mockState.language = 'en';
    render(<KinshipPanel graph={chainGraph()} fromId="P3" />);
    expect(screen.getByText('grandparent (2 generations)')).toBeTruthy();
  });

  it('getPersonName dipakai bila diberi', () => {
    render(
      <KinshipPanel
        graph={partnerGraph()}
        fromId="A"
        getPersonName={(id) => `Nama ${id}`}
      />,
    );
    expect(screen.getByText('Nama B')).toBeTruthy();
  });

  it('fallback personId bila getPersonName tidak diberi', () => {
    render(<KinshipPanel graph={partnerGraph()} fromId="A" />);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('empty state id bila tidak ada hubungan lain', () => {
    const g = buildKinshipGraph(['X'], [], []);
    render(<KinshipPanel graph={g} fromId="X" />);
    expect(screen.getByText('tidak ada hubungan lain')).toBeTruthy();
  });

  it('empty state en bila tidak ada hubungan lain', () => {
    mockState.language = 'en';
    const g = buildKinshipGraph(['X'], [], []);
    render(<KinshipPanel graph={g} fromId="X" />);
    expect(screen.getByText('no other relationships')).toBeTruthy();
  });

  it('dua relasi PARTNER legal tampil dua baris', () => {
    const g = buildKinshipGraph(
      ['A', 'B', 'C'],
      [makePartnerRelation('A', 'B'), makePartnerRelation('A', 'C')],
      [],
    );
    render(<KinshipPanel graph={g} fromId="A" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(screen.getAllByText(/^pasangan/)).toHaveLength(2);
  });

  it('graph kosong tidak crash', () => {
    const g = buildKinshipGraph([], [], []);
    render(<KinshipPanel graph={g} fromId="A" />);
    expect(screen.getByText('tidak ada hubungan lain')).toBeTruthy();
  });
});
