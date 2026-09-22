/**
 * @vitest-environment jsdom
 *
 * Test v144-i: MemberDetailSidebarKinship, sidebar kinship ringkas.
 * Hook useKinshipGraph dan react-i18next di-mock penuh; graph uji
 * dibangun via buildKinshipGraph dengan data statis deterministik.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import { makePartnerRelation } from '../../lib/genealogy/relationship';
import type { FamilyMember } from '../../types/family';
import { MemberDetailSidebarKinship } from './MemberDetailSidebarKinship';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  graph: null as KinshipGraph | null,
  selectedMember: null as FamilyMember | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mocks.language } }),
}));

vi.mock('../../hooks/useKinshipGraph', () => ({
  useKinshipGraph: () => ({ graph: mocks.graph, selectedMember: mocks.selectedMember }),
}));

function makeGraph(
  ids: string[],
  children: ChildLink[] = [],
  partners: ReturnType<typeof makePartnerRelation>[] = [],
): KinshipGraph {
  return buildKinshipGraph(ids, partners, children);
}

function member(id: string): FamilyMember {
  return { id } as unknown as FamilyMember;
}

const PARENT_LINK: ChildLink[] = [
  { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
];

const TEN_CHILD_LINKS: ChildLink[] = Array.from({ length: 10 }, (_, i) => ({
  childId: `c${i}`,
  parentId: 'ortu',
  type: 'BIRTH',
}));

beforeEach(() => {
  mocks.language = 'id';
  mocks.graph = null;
  mocks.selectedMember = null;
});

afterEach(cleanup);

describe('MemberDetailSidebarKinship', () => {
  it('kasus 1: selectedMember null merender null', () => {
    mocks.graph = makeGraph(['anak', 'ortu'], PARENT_LINK);
    mocks.selectedMember = null;
    const { container } = render(<MemberDetailSidebarKinship />);
    expect(container.innerHTML).toBe('');
  });

  it('kasus 2: relasi parent depth 1 locale id memuat frasa ayah atau ibu', () => {
    mocks.language = 'id';
    mocks.graph = makeGraph(['anak', 'ortu'], PARENT_LINK);
    mocks.selectedMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    expect(screen.getByText('ayah atau ibu')).toBeTruthy();
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.querySelectorAll('li').length).toBe(1);
  });

  it('kasus 3: relasi parent depth 1 locale en memuat frasa father or mother', () => {
    mocks.language = 'en';
    mocks.graph = makeGraph(['anak', 'ortu'], PARENT_LINK);
    mocks.selectedMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    expect(screen.getByText('father or mother')).toBeTruthy();
  });

  it('kasus 4: person tanpa relasi locale id merender teks kosong', () => {
    mocks.language = 'id';
    mocks.graph = makeGraph(['solo']);
    mocks.selectedMember = member('solo');
    render(<MemberDetailSidebarKinship />);
    expect(screen.getByText('tidak ada hubungan lain')).toBeTruthy();
  });

  it('kasus 5: person tanpa relasi locale en merender teks kosong', () => {
    mocks.language = 'en';
    mocks.graph = makeGraph(['solo']);
    mocks.selectedMember = member('solo');
    render(<MemberDetailSidebarKinship />);
    expect(screen.getByText('no other relationships')).toBeTruthy();
  });

  it('kasus 6: maksimal 8 li saat relasi lebih dari 8', () => {
    mocks.language = 'id';
    const ids = ['ortu', ...Array.from({ length: 10 }, (_, i) => `c${i}`)];
    mocks.graph = makeGraph(ids, TEN_CHILD_LINKS);
    mocks.selectedMember = member('ortu');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.querySelectorAll('li').length).toBe(8);
  });

  it('kasus 7: aria-label member-kinship tersedia pada wrapper ul', () => {
    mocks.language = 'id';
    mocks.graph = makeGraph(['anak', 'ortu'], PARENT_LINK);
    mocks.selectedMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    expect(screen.getByLabelText('member-kinship').tagName).toBe('UL');
  });

  it('kasus 8: render ulang dengan data sama menghasilkan output identik', () => {
    mocks.language = 'id';
    const ids = ['ortu', ...Array.from({ length: 10 }, (_, i) => `c${i}`)];
    mocks.graph = makeGraph(ids, TEN_CHILD_LINKS);
    mocks.selectedMember = member('ortu');
    const first = render(<MemberDetailSidebarKinship />);
    const html1 = first.container.innerHTML;
    first.unmount();
    const second = render(<MemberDetailSidebarKinship />);
    expect(second.container.innerHTML).toBe(html1);
  });
});
