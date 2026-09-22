/**
 * @vitest-environment jsdom
 *
 * GOAL v148-ii: wiring DedupReviewMount ke Dashboard.
 * Store (auth, dashboard, family) dan react-i18next di-mock dengan pola
 * vi.hoisted + vi.mock seperti DedupReviewMount.test.tsx (v148-i), karena
 * folder __tests__ Dashboard ini baru. Fokus pengujian: panel dedup
 * tersembunyi secara default, tombol pemicu menampilkannya, dan setiap
 * keputusan reviewer diteruskan ke handler (log terstruktur, ADR 0009).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import { Dashboard } from '../Dashboard';

const { mockMembers } = vi.hoisted(() => ({
  mockMembers: { list: [] as FamilyMember[] },
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { name: 'Pengguna Uji', email: 'uji@example.com', avatar: null },
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/dashboardStore', () => ({
  useDashboardStore: (selector?: (s: unknown) => unknown) => {
    const state = { familyTrees: [], viewMode: 'card', setViewMode: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (s: unknown) => unknown) =>
    selector({ members: mockMembers.list }),
}));

vi.mock('../../../utils/routing', () => ({ navigate: vi.fn() }));

vi.mock('../../../lib/i18n', () => ({ formatDate: () => '' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'dedupReview.open' ? 'Cek Duplikat' : key),
    i18n: { language: 'id' },
  }),
}));

function member(partial: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  return {
    birthDate: '',
    gender: 'male',
    ...partial,
  } as FamilyMember;
}

const A = 'member-a';
const B = 'member-b';
const PAIR_AB = `${A}::${B}`;

function seedOnePair(): void {
  mockMembers.list = [
    member({ id: A, name: 'Budi Santoso', birthDate: '1970-01-01' }),
    member({ id: B, name: 'Budi Santoso', birthDate: '1970-06-15' }),
  ];
}

beforeEach(() => {
  mockMembers.list = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Dashboard dedup wiring (v148-ii)', () => {
  it('kasus 1: panel dedup tidak tampil secara default', () => {
    render(<Dashboard />);
    expect(screen.queryByTestId('dedup-summary')).toBeNull();
    expect(screen.queryByTestId(`dedup-pair-${PAIR_AB}`)).toBeNull();
  });

  it('kasus 2: tombol Cek Duplikat menampilkan panel dedup', () => {
    seedOnePair();
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
    expect(screen.getByTestId('dedup-summary')).toBeTruthy();
    expect(screen.getByTestId(`dedup-pair-${PAIR_AB}`)).toBeTruthy();
  });

  it('kasus 3: klik accept memanggil handler (log terstruktur berisi pairId + decision)', () => {
    seedOnePair();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(payload.event).toBe('dedup-decision');
    expect(payload.pairId).toBe(PAIR_AB);
    expect(payload.decision).toBe('ACCEPT');
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('kasus 4: klik reject memanggil handler dengan decision REJECT', () => {
    seedOnePair();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
    fireEvent.click(screen.getByTestId(`dedup-reject-${PAIR_AB}`));
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(payload.pairId).toBe(PAIR_AB);
    expect(payload.decision).toBe('REJECT');
  });

  it('kasus 5: klik skip memanggil handler dengan decision SKIP', () => {
    seedOnePair();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
    fireEvent.click(screen.getByTestId(`dedup-skip-${PAIR_AB}`));
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(payload.pairId).toBe(PAIR_AB);
    expect(payload.decision).toBe('SKIP');
  });

  it('kasus 6: unmount bersih tanpa error dan panel hilang dari DOM', () => {
    seedOnePair();
    const { unmount } = render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
    expect(screen.getByTestId('dedup-summary')).toBeTruthy();
    expect(() => unmount()).not.toThrow();
    expect(screen.queryByTestId('dedup-summary')).toBeNull();
  });
});
