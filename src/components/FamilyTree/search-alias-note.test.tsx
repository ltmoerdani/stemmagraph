/**
 * @vitest-environment jsdom
 *
 * Test UI alias v179-ii: catatan alias yang sama seperti sidebar (v179-i)
 * ditampilkan di area hasil pencarian FamilyTable dan MemberCardGrid.
 * Pola mock persis src/components/Sidebar/alias-ui.test.tsx: vi.hoisted,
 * render/cleanup dari @testing-library/react, mock react-i18next,
 * mock store lewat vi.mock, mock kinship-alias-note lewat importOriginal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../types/family';
import type { AliasDisplay } from '../../lib/genealogy/kinship-alias-note';
import { FamilyTable } from './FamilyTable';
import { MemberCardGrid } from './MemberCardGrid';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    members: [] as FamilyMember[],
    viewMode: { showAlive: true, showDeceased: true, selectedGeneration: null as number | null },
    searchQuery: '',
    selectedMember: null as FamilyMember | null,
    setSelectedMember: vi.fn(),
  },
}));

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  aliasStub: null as
    | null
    | ((phrase: string, locale: 'id' | 'en') => AliasDisplay | null),
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (selector?: (s: unknown) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

vi.mock('./GridMemberCard', () => ({
  GridMemberCard: ({ member }: { member: { id: string; name: string } }) => (
    <div data-testid={`card-${member.id}`}>{member.name}</div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mocks.language },
  }),
}));

vi.mock('../../lib/i18n', () => ({
  formatDate: (value: string) => value,
}));

vi.mock('../../lib/genealogy/kinship-alias-note', async (importOriginal) => {
  const asli = await importOriginal<
    typeof import('../../lib/genealogy/kinship-alias-note')
  >();
  return {
    ...asli,
    aliasDisplay: (phrase: string, locale: 'id' | 'en' = 'id'): AliasDisplay | null =>
      mocks.aliasStub !== null
        ? mocks.aliasStub(phrase, locale)
        : asli.aliasDisplay(phrase, locale),
  };
});

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

beforeEach(() => {
  mockState.members = [member({ id: 'a', name: 'Budi Santoso' })];
  mockState.viewMode = { showAlive: true, showDeceased: true, selectedGeneration: null };
  mockState.searchQuery = '';
  mockState.selectedMember = null;
  mocks.language = 'id';
  mocks.aliasStub = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FamilyTable alias search note (v179-ii)', () => {
  it('kasus 1: query alias dikenali dengan note, catatan tampil', () => {
    mockState.searchQuery = 'buyut';
    render(<FamilyTable />);
    const note = screen.getByTestId('family-table-search-alias-note');
    expect(note.textContent).toContain('dua arah');
  });

  it('kasus 2: query alias tidak dikenali, nihil span catatan', () => {
    mockState.searchQuery = 'zzz-tidak-dikenal';
    render(<FamilyTable />);
    expect(screen.queryByTestId('family-table-search-alias-note')).toBeNull();
  });

  it('kasus 3: label baku tidak tertimpa saat catatan tampil', () => {
    mockState.searchQuery = 'aki';
    render(<FamilyTable />);
    const note = screen.getByTestId('family-table-search-alias-note');
    expect(note.textContent).toContain('kakek nenek');
  });

  it('kasus 4: prioritas note di atas region bila keduanya ada', () => {
    mockState.searchQuery = 'eyang';
    mocks.aliasStub = (phrase) =>
      phrase === 'eyang'
        ? { label: 'kakek nenek', note: 'catatan utama', region: 'Jawa', register: 'hormat' }
        : null;
    render(<FamilyTable />);
    const note = screen.getByTestId('family-table-search-alias-note');
    expect(note.textContent).toContain('catatan utama');
    expect(note.textContent).not.toContain('Jawa');
  });

  it('kasus 5: query nama anggota biasa (bukan alias), dedup hasil tidak rusak, nihil catatan', () => {
    mockState.searchQuery = 'budi';
    render(<FamilyTable />);
    expect(screen.queryByTestId('family-table-search-alias-note')).toBeNull();
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Budi Santoso');
  });

  it('kasus 6: locale en, label dan catatan mengikuti locale', () => {
    mocks.language = 'en';
    mockState.searchQuery = 'kakek atau nenek';
    mocks.aliasStub = (phrase, locale) =>
      phrase === 'kakek atau nenek'
        ? {
            label: locale === 'en' ? 'grandparent' : 'kakek nenek',
            note: null,
            region: 'Sunda',
            register: null,
          }
        : null;
    render(<FamilyTable />);
    const note = screen.getByTestId('family-table-search-alias-note');
    expect(note.textContent).toContain('grandparent');
    expect(note.textContent).toContain('Sunda');
  });

  it('kasus 7: query kosong, nihil catatan (guard homonim aliasDisplay null)', () => {
    mockState.searchQuery = '';
    render(<FamilyTable />);
    expect(screen.queryByTestId('family-table-search-alias-note')).toBeNull();
  });
});

describe('MemberCardGrid alias search note (v179-ii)', () => {
  it('kasus 8: query alias dikenali di grid, catatan tampil dan kartu hasil tetap tampil', () => {
    mockState.searchQuery = 'misan';
    render(<MemberCardGrid />);
    const note = screen.getByTestId('member-card-grid-search-alias-note');
    expect(note.textContent).toContain('sepupu');
  });
});
