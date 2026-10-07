/**
 * @vitest-environment jsdom
 *
 * GOAL v252-iv: chip marga di hasil pencarian (salvase PM).
 * Chip tampil di sel nama FamilyTable dan wrapper kartu MemberCardGrid
 * bila matchesMargaTolerant(member.marga, searchQuery) true. Pola mock
 * meniru search-wiring.test.tsx (jangkar v150-ii).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import { MemberCardGrid } from '../MemberCardGrid';
import { FamilyTable } from '../FamilyTable';
import idCanvas from '../../../lib/i18n/locales/id/canvas.json';
import enCanvas from '../../../lib/i18n/locales/en/canvas.json';

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

describe('marga chip v252-iv', () => {
  it('kasus 1: chip tampil di tabel saat query cocok marga eksak', () => {
    mockState.members = [member({ id: 'a', name: 'Budi', marga: 'Perangin-angin' })];
    mockState.searchQuery = 'perangin-angin';
    const { container } = render(<FamilyTable />);
    expect(screen.getByTestId('marga-chip-a')).toBeTruthy();
    expect(container.textContent).toContain('Budi');
  });

  it('kasus 2: chip tampil saat query ber-spasi vs marga ber-hyfen (lapis kunci rapat)', () => {
    mockState.members = [member({ id: 'a', name: 'Budi', marga: 'Perangin-angin' })];
    mockState.searchQuery = 'Perangin Angin';
    render(<FamilyTable />);
    expect(screen.getByTestId('marga-chip-a')).toBeTruthy();
  });

  it('kasus 3: chip TIDAK tampil saat match hanya via nama', () => {
    mockState.members = [member({ id: 'a', name: 'Budi Santoso', marga: 'Simanjuntak' })];
    mockState.searchQuery = 'budi';
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Budi Santoso');
    expect(screen.queryByTestId('marga-chip-a')).toBeNull();
  });

  it('kasus 4: chip TIDAK tampil bila marga null meski nama cocok', () => {
    mockState.members = [member({ id: 'a', name: 'Budi', marga: null })];
    mockState.searchQuery = 'budi';
    render(<FamilyTable />);
    expect(screen.queryByTestId('marga-chip-a')).toBeNull();
  });

  it('kasus 5: chip tampil di grid kartu saat query cocok marga', () => {
    mockState.members = [member({ id: 'a', name: 'Budi', marga: 'Sembiring Meliala' })];
    mockState.searchQuery = 'sembiring';
    render(<MemberCardGrid />);
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.getByTestId('marga-chip-a')).toBeTruthy();
  });

  it('kasus 6: i18n parity, key table.margaChipPrefix ada di canvas id dan en', () => {
    const cek = (obj: unknown): string => {
      const marga = (obj as Record<string, Record<string, string>>).table?.margaChipPrefix;
      expect(typeof marga).toBe('string');
      return marga ?? '';
    };
    expect(cek(idCanvas).length).toBeGreaterThan(0);
    expect(cek(enCanvas).length).toBeGreaterThan(0);
    expect(cek(idCanvas)).toBe(cek(enCanvas));
  });

  it('kasus 7: tanpa query, marga terisi tidak memunculkan chip (regresi tampilan normal)', () => {
    mockState.members = [member({ id: 'a', name: 'Budi', marga: 'Perangin-angin' })];
    mockState.searchQuery = '';
    const { container } = render(<FamilyTable />);
    expect(container.textContent).toContain('Budi');
    expect(screen.queryByTestId('marga-chip-a')).toBeNull();
  });

  it('kasus 8: kombinasi match marga dan nama tampil lengkap, chip hanya pada baris marga', () => {
    mockState.members = [
      member({ id: 'c', name: 'Candra', marga: 'Ginting' }),
      member({ id: 'a', name: 'Andi Ginting', marga: null }),
      member({ id: 'b', name: 'Budi', marga: 'Sembiring Meliala' }),
    ];
    mockState.searchQuery = 'ginting';
    render(<FamilyTable />);
    expect(screen.getByTestId('marga-chip-c')).toBeTruthy();
    expect(screen.queryByTestId('marga-chip-a')).toBeNull();
    expect(screen.queryByTestId('marga-chip-b')).toBeNull();
    const semua = containerText();
    expect(semua).toContain('Candra');
    expect(semua).toContain('Andi Ginting');
    expect(semua).not.toContain('Budi');
  });
});

function containerText(): string {
  return document.body.textContent ?? '';
}

export {};
