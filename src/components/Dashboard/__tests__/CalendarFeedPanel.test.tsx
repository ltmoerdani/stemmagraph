/**
 * @vitest-environment jsdom
 *
 * Test wiring panel langganan kalender (v394 AC5): tombol masuk tampil
 * hanya owner/editor, panel termount dari tombol, rotate menampilkan
 * token dan URL sekali, salin terpanggil, revoke menyembunyikan URL,
 * viewer tanpa tombol.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CalendarFeedPanel } from '../CalendarFeedPanel';
import { Dashboard } from '../Dashboard';

const mocks = vi.hoisted(() => ({
  rotateCalendarToken: vi.fn(async () => ({ token: 'tok-1234567890abcdef' })),
  revokeCalendarToken: vi.fn(async () => ({ revoked: true })),
}));

const state = vi.hoisted(() => ({
  trees: [] as Array<{ id: string; name: string; role: string; memberCount: number; generationCount: number; lastUpdated: string; createdAt: string }>,
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const s = { user: { name: 'U', email: 'u@e.id', avatar: null } };
    return selector ? selector(s) : s;
  },
}));

vi.mock('../../../store/dashboardStore', () => ({
  useDashboardStore: (selector?: (s: unknown) => unknown) => {
    const s = { familyTrees: state.trees, viewMode: 'card', setViewMode: vi.fn(), createFamilyTree: vi.fn() };
    return selector ? selector(s) : s;
  },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (s: unknown) => unknown) => selector({ members: [] }),
}));

vi.mock('../../../utils/routing', () => ({ navigate: vi.fn() }));

vi.mock('../../../lib/i18n', () => ({ formatDate: () => '' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'id' },
  }),
}));

vi.mock('../../FamilyTree/DedupReviewMount', () => ({ DedupReviewMount: () => null }));

vi.mock('../../../lib/adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/adapters')>();
  return {
    ...actual,
    getMergeApi: () => null,
    getCalendarFeedApi: () => ({ rotateCalendarToken: mocks.rotateCalendarToken, revokeCalendarToken: mocks.revokeCalendarToken }),
  };
});

function tree(id: string, role: string): { id: string; name: string; role: string; memberCount: number; generationCount: number; lastUpdated: string; createdAt: string } {
  return { id, name: `Tree ${id}`, role, memberCount: 1, generationCount: 1, lastUpdated: '2026-10-25', createdAt: '2026-10-25' };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.trees = [];
});

afterEach(cleanup);

describe('CalendarFeedPanel (v394 AC5)', () => {
  it('inactive: teks belum aktif, tombol create tampil', async () => {
    render(<CalendarFeedPanel treeId="t1" treeName="Keluarga Uji" onClose={() => undefined} />);
    expect(screen.getByTestId('calendar-feed-inactive')).toBeTruthy();
    expect(screen.getByTestId('calendar-feed-rotate').textContent).toContain('calendarFeed.panel.create');
  });

  it('rotate sukses: token dan URL tampil, tombol berubah rotate, salin bekerja', async () => {
    render(<CalendarFeedPanel treeId="t1" treeName="Keluarga Uji" onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('calendar-feed-rotate'));
    await waitFor(() => expect(mocks.rotateCalendarToken).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.getByTestId('calendar-feed-url')).toBeTruthy());
    const url = screen.getByTestId('calendar-feed-url').textContent ?? '';
    expect(url).toContain('/api/v1/trees/t1/calendar.ics?token=tok-1234567890abcdef');
    expect(screen.getByTestId('calendar-feed-rotate').textContent).toContain('calendarFeed.panel.rotate');
    fireEvent.click(screen.getByTestId('calendar-feed-copy'));
    await waitFor(() => expect(screen.getByTestId('calendar-feed-copy').textContent).toContain('calendarFeed.panel.copied'));
  });

  it('revoke sukses: URL hilang kembali ke inactive', async () => {
    render(<CalendarFeedPanel treeId="t1" treeName="Keluarga Uji" onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('calendar-feed-rotate'));
    await waitFor(() => expect(screen.getByTestId('calendar-feed-url')).toBeTruthy());
    fireEvent.click(screen.getByTestId('calendar-feed-revoke'));
    await waitFor(() => expect(mocks.revokeCalendarToken).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.getByTestId('calendar-feed-inactive')).toBeTruthy());
    expect(screen.queryByTestId('calendar-feed-url')).toBeNull();
  });

  it('rotate gagal: error tampil tanpa crash', async () => {
    mocks.rotateCalendarToken.mockRejectedValueOnce(new Error('403 FORBIDDEN_TREE'));
    render(<CalendarFeedPanel treeId="t1" treeName="Keluarga Uji" onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('calendar-feed-rotate'));
    await waitFor(() => expect(screen.getByTestId('calendar-feed-error').textContent).toContain('403'));
  });
});

describe('Dashboard wiring kalender feed (v394 AC5)', () => {
  it('owner tree: tombol kalender tampil, klik membuka panel', async () => {
    state.trees = [tree('t1', 'owner')];
    render(<Dashboard />);
    const btn = await waitFor(() => screen.getByTitle('calendarFeed.open'));
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('calendar-feed-title')).toBeTruthy());
  });

  it('editor tree: tombol kalender tampil', async () => {
    state.trees = [tree('t1', 'editor')];
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTitle('calendarFeed.open')).toBeTruthy());
  });

  it('viewer tree: tanpa tombol kalender', async () => {
    state.trees = [tree('t1', 'viewer')];
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeTruthy());
    expect(screen.queryByTitle('calendarFeed.open')).toBeNull();
  });
});
