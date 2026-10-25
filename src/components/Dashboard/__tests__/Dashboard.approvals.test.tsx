/**
 * @vitest-environment jsdom
 *
 * Test wiring badge approval merge di Dashboard (v392 AC6): badge jumlah
 * PENDING tampil untuk tree owner/editor bila > 0, klik membuka
 * MergeApprovalsPanel, nihil badge saat queue kosong, viewer tanpa badge,
 * adapter tanpa server tanpa badge tanpa crash.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

const mocks = vi.hoisted(() => ({
  listMergeApprovals: vi.fn(async () => [] as Array<Record<string, unknown>>),
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
    getMergeApi: () => ({ listMergeApprovals: mocks.listMergeApprovals }),
  };
});

function tree(id: string, role: string): { id: string; name: string; role: string; memberCount: number; generationCount: number; lastUpdated: string; createdAt: string } {
  return { id, name: `Tree ${id}`, role, memberCount: 1, generationCount: 1, lastUpdated: '2026-10-25', createdAt: '2026-10-25' };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listMergeApprovals.mockResolvedValue([]);
  state.trees = [];
});

afterEach(cleanup);

describe('Dashboard approvals badge wiring (v392 AC6)', () => {
  it('owner tree dengan 2 PENDING: badge tampil dengan angka dan klik membuka panel', async () => {
    state.trees = [tree('t1', 'owner')];
    mocks.listMergeApprovals.mockResolvedValue([
      { id: 'apr-1' },
      { id: 'apr-2' },
    ]);
    render(<Dashboard />);
    const badge = await waitFor(() => screen.getByTestId('approvals-badge-t1'));
    expect(badge.textContent).toContain('2');
    fireEvent.click(badge);
    await waitFor(() => expect(screen.getByTestId('merge-approvals-title')).toBeTruthy());
  });

  it('queue kosong: badge nihil', async () => {
    state.trees = [tree('t1', 'owner')];
    render(<Dashboard />);
    await waitFor(() => expect(mocks.listMergeApprovals).toHaveBeenCalledWith('t1', { status: 'PENDING' }));
    await waitFor(() => expect(screen.queryByTestId('approvals-badge-t1')).toBeNull());
  });

  it('viewer tree: tanpa fetch approval dan tanpa badge', async () => {
    state.trees = [tree('t1', 'viewer')];
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeTruthy());
    expect(mocks.listMergeApprovals).not.toHaveBeenCalled();
    expect(screen.queryByTestId('approvals-badge-t1')).toBeNull();
  });

  it('fetch gagal (403 viewer server-side): tanpa badge tanpa crash', async () => {
    state.trees = [tree('t1', 'editor')];
    mocks.listMergeApprovals.mockRejectedValueOnce(new Error('403'));
    render(<Dashboard />);
    await waitFor(() => expect(mocks.listMergeApprovals).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('approvals-badge-t1')).toBeNull());
    expect(screen.getByTestId('dashboard')).toBeTruthy();
  });
});
