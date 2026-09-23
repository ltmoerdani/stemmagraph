/**
 * @vitest-environment jsdom
 *
 * GOAL v150-ii: wiring komponen ke engine search-filter fase i.
 * Pola mock meniru DedupReviewMount.test.tsx: useFamilyStore via vi.mock
 * dengan state fixture, komponen diuji sebagai bridge store ke engine.
 * Kasus 2 sampai 4 mengunci opsi terstruktur engine (birthPlace, gender,
 * generation) yang menjadi dasar kontrak wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import { applySearchFilter, type SearchMember } from '../../../lib/genealogy/search-filter';
import { MemberCardGrid } from '../MemberCardGrid';
import { FamilyTable } from '../FamilyTable';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    members: [] as FamilyMember[],
    viewMode: { showAlive: true, showDeceased: true, selectedGeneration: null as number | null },
    searchQuery: '',
    selectedMember: null as FamilyMember | null,
  },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector?: (s: unknown) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

vi.mock('../GridMemberCard', () => ({
  GridMemberCard: ({ member }: { member: { id: string; name: string } }) => (
    <div data-testid={`card-${member.id}`}>{member.name}</div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'id' },
  }),
}));

vi.mock('../../../lib/i18n', () => ({
  formatDate: (value: string) => value,
}));

function member(partial: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  return {
    birthDate: '1970-01-01',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...partial,
  } as FamilyMember;
}

function searchMember(partial: Partial<SearchMember> & { id: string; name: string }): SearchMember {
  return {
    gender: 'M',
    generation: 1,
    ...partial,
  };
}

beforeEach(() => {
  mockState.members = [];
  mockState.viewMode = { showAlive: true, showDeceased: true, selectedGeneration: null };
  mockState.searchQuery = '';
  mockState.selectedMember = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('search wiring v150-ii', () => {
  it('kasus 1 (wiring grid): query cocok name hanya menampilkan anggota yang cocok', () => {
    mockState.members = [
      member({ id: 'a', name: 'Budi Santoso' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'budi';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 2 (engine): opsi birthPlace cocok substring case-insensitive', () => {
    const members = [
      searchMember({ id: 'a', name: 'Budi', birthPlace: 'Bandung, Jawa Barat' }),
      searchMember({ id: 'b', name: 'Andi', birthPlace: 'Surabaya, Jawa Timur' }),
    ];
    const hasil = applySearchFilter(members, '', { birthPlace: 'bandung' });
    expect(hasil.map((m) => m.id)).toEqual(['a']);
  });

  it('kasus 3 (engine): opsi gender menyaring jenis kelamin sama persis', () => {
    const members = [
      searchMember({ id: 'a', name: 'Budi', gender: 'M' }),
      searchMember({ id: 'b', name: 'Sari', gender: 'F' }),
    ];
    const hasil = applySearchFilter(members, '', { gender: 'F' });
    expect(hasil.map((m) => m.id)).toEqual(['b']);
  });

  it('kasus 4 (engine): opsi generation menyaring nomor generasi sama persis', () => {
    const members = [
      searchMember({ id: 'a', name: 'Budi', generation: 1 }),
      searchMember({ id: 'b', name: 'Andi', generation: 2 }),
    ];
    const hasil = applySearchFilter(members, '', { generation: 2 });
    expect(hasil.map((m) => m.id)).toEqual(['b']);
  });

  it('kasus 5 (wiring grid): showAlive menurunkan isAlive dari deathDate', () => {
    mockState.members = [
      member({ id: 'a', name: 'Budi Santoso' }),
      member({ id: 'b', name: 'Andi Wijaya', deathDate: '2020-01-01', isAlive: false }),
    ];
    mockState.viewMode = { showAlive: true, showDeceased: false, selectedGeneration: null };
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 6 (wiring grid): show all menghasilkan urutan deterministik (name asc)', () => {
    mockState.members = [
      member({ id: 'c', name: 'Candra' }),
      member({ id: 'a', name: 'Andi' }),
      member({ id: 'b', name: 'Budi' }),
    ];
    render(<MemberCardGrid />);
    const urutan = screen
      .getAllByTestId(/^card-/)
      .map((node) => node.getAttribute('data-testid'));
    expect(urutan).toEqual(['card-a', 'card-b', 'card-c']);
  });

  it('kasus 7 (wiring tabel): query name hanya menampilkan baris yang cocok', () => {
    mockState.members = [
      member({ id: 'a', name: 'Budi Santoso' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'budi';
    const { container } = render(<FamilyTable />);
    // Nama dipecah elemen mark oleh highlight, asersi via textContent.
    expect(container.textContent).toContain('Budi Santoso');
    expect(container.textContent).not.toContain('Andi Wijaya');
  });
});
