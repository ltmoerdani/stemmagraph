/**
 * @vitest-environment jsdom
 *
 * GOAL v154-iii: wiring TemplatePicker ke Dashboard (empty state).
 * Pola vi.hoisted + vi.mock mengikuti Dashboard.dedup.test.tsx (v148-ii).
 * Fokus: picker hanya tampil saat pohon kosong, klik kartu template
 * memanggil createFamilyTree dengan nama template, dan tidak ada render
 * picker saat pohon sudah ada.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

const { mockDashboard } = vi.hoisted(() => ({
  mockDashboard: {
    familyTrees: [] as Array<Record<string, unknown>>,
    createFamilyTree: vi.fn(),
  },
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
    const state = {
      familyTrees: mockDashboard.familyTrees,
      viewMode: 'card',
      setViewMode: vi.fn(),
      createFamilyTree: mockDashboard.createFamilyTree,
    };
    return selector ? selector(state) : state;
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

vi.mock('../../lib/genealogy/build-merge-proposal', () => ({
  buildMergeProposal: vi.fn(),
}));

const TREE_A = {
  id: 'tree-a',
  name: 'Pohon A',
  role: 'owner',
  memberCount: 3,
  generationCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  lastUpdated: '2026-01-02T00:00:00Z',
};

beforeEach(() => {
  mockDashboard.familyTrees = [];
  mockDashboard.createFamilyTree = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Dashboard onboarding wiring (v154-iii)', () => {
  it('kasus 1: picker template tampil saat belum ada pohon', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('onboarding-template-picker')).toBeTruthy();
    expect(screen.getByTestId('template-card-keluarga-inti')).toBeTruthy();
  });

  it('kasus 2: picker tidak tampil saat sudah ada pohon', () => {
    mockDashboard.familyTrees = [TREE_A];
    render(<Dashboard />);
    expect(screen.queryByTestId('onboarding-template-picker')).toBeNull();
    expect(screen.queryByTestId('template-card-keluarga-inti')).toBeNull();
  });

  it('kasus 3: klik kartu template memanggil createFamilyTree dengan nama template', async () => {
    mockDashboard.createFamilyTree.mockResolvedValue(TREE_A);
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('template-card-keluarga-inti'));
    await vi.waitFor(() => {
      expect(mockDashboard.createFamilyTree).toHaveBeenCalledTimes(1);
    });
    expect(mockDashboard.createFamilyTree).toHaveBeenCalledWith('Keluarga Inti');
  });

  it('kasus 4: klik kartu tarombo-batak memanggil createFamilyTree nama Tarombo', async () => {
    mockDashboard.createFamilyTree.mockResolvedValue(TREE_A);
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('template-card-tarombo-batak'));
    await vi.waitFor(() => {
      expect(mockDashboard.createFamilyTree).toHaveBeenCalledWith('Tarombo (Batak)');
    });
  });

  it('kasus 5: klik kartu zupu memanggil createFamilyTree nama Zupu', async () => {
    mockDashboard.createFamilyTree.mockResolvedValue(TREE_A);
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('template-card-zupu'));
    await vi.waitFor(() => {
      expect(mockDashboard.createFamilyTree).toHaveBeenCalledWith('Zupu (Silsilah Klan)');
    });
  });

  it('kasus 6: createFamilyTree gagal tidak melempar crash dan picker tetap ada', async () => {
    mockDashboard.createFamilyTree.mockRejectedValue(new Error('db down'));
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('template-card-keluarga-inti'));
    await vi.waitFor(() => {
      expect(mockDashboard.createFamilyTree).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('onboarding-template-picker')).toBeTruthy();
  });

  it('kasus 7: klik ganda cepat hanya memanggil createFamilyTree satu kali', async () => {
    mockDashboard.createFamilyTree.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(TREE_A), 50)),
    );
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('template-card-keluarga-inti'));
    fireEvent.click(screen.getByTestId('template-card-keluarga-inti'));
    await vi.waitFor(() => {
      expect(mockDashboard.createFamilyTree).toHaveBeenCalledTimes(1);
    });
  });

  it('kasus 8: judul empty state dan picker tampil bersama di card view', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.emptyTitle')).toBeTruthy();
    expect(screen.getByTestId('onboarding-template-picker')).toBeTruthy();
  });
});
