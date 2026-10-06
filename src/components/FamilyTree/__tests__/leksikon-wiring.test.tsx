/**
 * @vitest-environment jsdom
 *
 * GOAL v249-i: wiring komponen UI (MemberCardGrid, FamilyTable) ke bridge
 * leksikon-search-bridge (searchMembersWithLeksikon menggantikan
 * searchWithAliases). Pola mock meniru search-wiring.test.tsx: state
 * fixture via vi.hoisted, GridMemberCard di-mock, react-i18next di-stub,
 * jsdom environment. Kasus bridge langsung mengunci kontrak ekspansi dan
 * dedup by id yang menjadi dasar wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import {
  searchMembersWithLeksikon,
  expandQueryWithLeksikon,
} from '../../../lib/genealogy/leksikon-search-bridge';
import type { SearchMember } from '../../../lib/genealogy/search-filter';
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

describe('leksikon wiring v249-i', () => {
  it('kasus 1 (bridge): expandQueryWithLeksikon memuat query asli di indeks 0 lalu lemma dan alias entri', () => {
    const terms = expandQueryWithLeksikon('eik simawangon');
    expect(terms[0]).toBe('eik simawangon');
    expect(terms).toContain('Kali Lumut');
    expect(terms.length).toBeGreaterThanOrEqual(2);
  });

  it('kasus 2 (bridge): query kosong menghasilkan ekspansi kosong', () => {
    expect(expandQueryWithLeksikon('')).toEqual([]);
    expect(expandQueryWithLeksikon('   ')).toEqual([]);
  });

  it('kasus 3 (bridge): query tak dikenal hanya menghasilkan query asli', () => {
    expect(expandQueryWithLeksikon('zzqq')).toEqual(['zzqq']);
  });

  it('kasus 4 (bridge): dedup by id saat anggota cocok query asli dan bentuk lemma sekaligus', () => {
    const members = [
      searchMember({ id: 'a', name: 'Kali Lumut', birthPlace: 'Eik Simawangon' }),
      searchMember({ id: 'b', name: 'Andi' }),
    ];
    const hasil = searchMembersWithLeksikon(members, 'eik simawangon');
    expect(hasil.map((m) => m.id)).toEqual(['a']);
  });

  it('kasus 5 (wiring grid): query alias leksikon menampilkan anggota bermata lemma', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'Eik Simawangon';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 6 (wiring grid): ejaan pra-1947 Loemoet tetap menemukan anggota lemma Kali Lumut', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Budi Santoso' }),
    ];
    mockState.searchQuery = 'Loemoet';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 7 (wiring grid): query tak dikenal kembali ke pencarian substring biasa', () => {
    mockState.members = [
      member({ id: 'a', name: 'Zulkarnain' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'zul';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 8 (wiring grid): query kosong menampilkan semua anggota', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.getByTestId('card-b')).toBeTruthy();
  });

  it('kasus 9 (wiring grid): ekspansi leksikon tidak melewati filter showDeceased false', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Eik Simawangon', deathDate: '2020-01-01', isAlive: false }),
    ];
    mockState.searchQuery = 'Eik Simawangon';
    mockState.viewMode = { showAlive: true, showDeceased: false, selectedGeneration: null };
    render(<MemberCardGrid />);
    // a tampil lewat ekspansi alias ke lemma, b cocok query asli namun sudah meninggal.
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 10 (wiring grid): anggota dengan lemma di nickname ditemukan lewat alias', () => {
    mockState.members = [
      member({ id: 'a', name: 'Budi Santoso', nickname: 'Kali Lumut' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'Eik Simawangon';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByTestId('card-b')).toBeNull();
  });

  it('kasus 11 (wiring tabel): query alias leksikon menampilkan baris lemma dan menyembunyikan lainnya', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'Eik Simawangon';
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Kali Lumut');
    expect(container.textContent).not.toContain('Andi Wijaya');
  });

  it('kasus 12 (wiring tabel): query lemma empung menemukan anggota bernama Empung', () => {
    mockState.members = [
      member({ id: 'a', name: 'Empung Sitompul' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    mockState.searchQuery = 'empung';
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Empung Sitompul');
    expect(container.textContent).not.toContain('Andi Wijaya');
  });

  it('kasus 13 (wiring tabel): query kosong menampilkan semua baris', () => {
    mockState.members = [
      member({ id: 'a', name: 'Kali Lumut' }),
      member({ id: 'b', name: 'Andi Wijaya' }),
    ];
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Kali Lumut');
    expect(container.textContent).toContain('Andi Wijaya');
  });
});
