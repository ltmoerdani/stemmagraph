/**
 * @vitest-environment jsdom
 *
 * Test wiring v144-ii: MemberDetailSidebar merender MemberDetailSidebarKinship.
 * Store familyStore, hook useKinshipGraph, react-i18next, dan UnifiedMemberModal
 * di-mock penuh; graph uji dibangun via buildKinshipGraph statis deterministik.
 * Asersi fungsional saja, tanpa asersi class layout agar tahan refactor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import type { FamilyMember } from '../../types/family';
import { MemberDetailSidebar } from './MemberDetailSidebar';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  graph: null as KinshipGraph | null,
  hookMember: null as FamilyMember | null,
  storeMember: null as FamilyMember | null,
  setSelectedMember: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mocks.language } }),
}));

vi.mock('../../hooks/useKinshipGraph', () => ({
  useKinshipGraph: () => ({ graph: mocks.graph, selectedMember: mocks.hookMember }),
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: () => ({
    selectedMember: mocks.storeMember,
    setSelectedMember: mocks.setSelectedMember,
  }),
}));

vi.mock('../Forms/UnifiedMemberModal', () => ({
  UnifiedMemberModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="unified-modal" /> : null,
}));

const PARENT_LINK: ChildLink[] = [
  { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
];

function member(id: string): FamilyMember {
  return { id } as unknown as FamilyMember;
}

function detailMember(id: string): FamilyMember {
  return {
    id,
    name: 'Anak Uji',
    birthDate: '1990-01-01',
    isAlive: true,
    maritalStatus: 'single',
  } as unknown as FamilyMember;
}

beforeEach(() => {
  mocks.language = 'id';
  mocks.graph = null;
  mocks.hookMember = null;
  mocks.storeMember = null;
  mocks.setSelectedMember = vi.fn();
});

afterEach(cleanup);

describe('MemberDetailSidebar wiring kinship', () => {
  it('kasus 1: selectedMember terisi merender list aria-label member-kinship', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    mocks.storeMember = detailMember('anak');
    render(<MemberDetailSidebar />);
    expect(screen.getByLabelText('member-kinship')).toBeTruthy();
  });

  it('kasus 2: selectedMember null, sidebar tidak merender apa pun', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.hookMember = null;
    mocks.storeMember = null;
    const { container } = render(<MemberDetailSidebar />);
    expect(container.innerHTML).toBe('');
  });

  it('kasus 3: graph bapak-anak, section kinship memuat frasa ayah dan elemen li', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    mocks.storeMember = detailMember('anak');
    render(<MemberDetailSidebar />);
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.textContent).toContain('ayah');
    expect(ul.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('kasus 4: graph tanpa relasi, kinship menampilkan baris kosong sebagai li', () => {
    mocks.graph = buildKinshipGraph(['anak'], [], []);
    mocks.hookMember = member('anak');
    mocks.storeMember = detailMember('anak');
    render(<MemberDetailSidebar />);
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.querySelectorAll('li').length).toBe(1);
    expect(ul.textContent).toContain('tidak ada hubungan lain');
  });

  it('kasus 5: UnifiedMemberModal tidak tampil saat awal', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    mocks.storeMember = detailMember('anak');
    render(<MemberDetailSidebar />);
    expect(screen.queryByTestId('unified-modal')).toBeNull();
  });

  it('kasus 6: klik tombol Edit tetap membuka modal setelah wiring', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    mocks.storeMember = detailMember('anak');
    render(<MemberDetailSidebar />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(screen.getByTestId('unified-modal')).toBeTruthy();
  });
});
