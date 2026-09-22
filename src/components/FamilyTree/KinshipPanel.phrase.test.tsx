/**
 * @vitest-environment jsdom
 *
 * GOAL v142-STG-KINSHIP-PHRASE fase ii: wiring frasa naratif
 * kinshipPhrase ke KinshipPanel. Pola mengikuti KinshipPanel.test.tsx:
 * graph dibangun manual via ChildLink/partners, react-i18next di-mock
 * minimal pada i18n.language.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import { makePartnerRelation } from '../../lib/genealogy/relationship';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';
import type { RelationshipResult } from '../../lib/genealogy/kinship-calc';
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

/** Rantai empat generasi: P1 tua P2, P2 tua P3, P3 tua P4. */
function fourGenGraph(): KinshipGraph {
  return buildKinshipGraph(
    ['P1', 'P2', 'P3', 'P4'],
    [],
    [link('P2', 'P1'), link('P3', 'P2'), link('P4', 'P3')],
  );
}

function parentGraph(): KinshipGraph {
  return buildKinshipGraph(['Ayah', 'Anak'], [], [link('Anak', 'Ayah')]);
}

/** Kakek, dua anak (Ayah, Om), dan anak dari Ayah. */
function uncleGraph(): KinshipGraph {
  return buildKinshipGraph(
    ['Kakek', 'Ayah', 'Om', 'Anak'],
    [],
    [link('Ayah', 'Kakek'), link('Om', 'Kakek'), link('Anak', 'Ayah')],
  );
}

beforeEach(() => {
  mockState.language = 'id';
});

afterEach(cleanup);

describe('KinshipPanel frasa kinshipPhrase', () => {
  it('frasa id parent depth 1: ayah atau ibu', () => {
    render(<KinshipPanel graph={parentGraph()} fromId="Anak" />);
    expect(screen.getByText('ayah atau ibu')).toBeTruthy();
  });

  it('frasa en ancestor depth 3: great-grandparent', () => {
    mockState.language = 'en';
    render(<KinshipPanel graph={fourGenGraph()} fromId="P4" />);
    expect(screen.getByText('great-grandparent')).toBeTruthy();
  });

  it('frasa id parent-sibling: paman atau bibi', () => {
    render(<KinshipPanel graph={uncleGraph()} fromId="Anak" />);
    expect(
      screen.getByText('paman atau bibi (saudara ayah atau ibu)'),
    ).toBeTruthy();
  });

  it('frasa id sibling-child: keponakan (anak saudara)', () => {
    render(<KinshipPanel graph={uncleGraph()} fromId="Om" />);
    expect(screen.getByText('keponakan (anak saudara)')).toBeTruthy();
  });

  it('fallback kind tak dikenal tidak throw dan panel tetap render', () => {
    const asing = { kind: '_unknown' } as unknown as RelationshipResult;
    expect(() => kinshipPhrase(asing, 'id')).not.toThrow();
    expect(kinshipPhrase(asing, 'id')).toBe('hubungan tidak dikenal');
    render(<KinshipPanel graph={parentGraph()} fromId="Anak" />);
    expect(screen.getByText('ayah atau ibu')).toBeTruthy();
  });

  it('determinisme: render ulang menghasilkan frasa identik', () => {
    const { rerender } = render(
      <KinshipPanel graph={uncleGraph()} fromId="Anak" />,
    );
    const first = screen.getAllByTestId('kinship-phrase').map((el) => el.textContent);
    rerender(<KinshipPanel graph={uncleGraph()} fromId="Anak" />);
    const second = screen.getAllByTestId('kinship-phrase').map((el) => el.textContent);
    expect(second).toEqual(first);
    expect(first).toContain('paman atau bibi (saudara ayah atau ibu)');
  });

  it('span frasa muncul di DOM untuk tiap baris relasi', () => {
    render(
      <KinshipPanel
        graph={buildKinshipGraph(
          ['A', 'B', 'C'],
          [makePartnerRelation('A', 'B'), makePartnerRelation('A', 'C')],
          [],
        )}
        fromId="A"
      />,
    );
    const spans = screen.getAllByTestId('kinship-phrase');
    expect(spans).toHaveLength(2);
    for (const span of spans) {
      expect(span.textContent).toBe('suami atau istri');
    }
  });
});
