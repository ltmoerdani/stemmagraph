/**
 * @vitest-environment jsdom
 *
 * GOAL v109 slice 2: fallback offline fetchMembers + banner offline.
 * (a) adapter gagal + getTree sukses: offlineLoaded true, members terisi
 *     lewat deserializeTree asli (payload SerializedTree valid).
 * (b) getTree null atau payload rusak: offlineLoaded false, tanpa crash.
 * (c) OfflineBanner: null saat offlineLoaded false, teks i18n saat true.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'offline.banner': 'Data dimuat dari perangkat karena koneksi terputus',
        'offline.reconnect.refreshed': 'Data pohon dimuat ulang dari server, koneksi kembali',
        'offline.reconnect.kept': 'Data lokal lebih baru, tidak ditimpa server',
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock('@/lib/adapters', () => ({
  getAdapter: () => ({
    listMembers: vi.fn().mockRejectedValue(new Error('network down')),
    listRelationships: vi.fn().mockRejectedValue(new Error('network down')),
  }),
}));

vi.mock('@/lib/offline/idb', () => ({
  getTree: vi.fn(),
}));

import { useFamilyStore } from '../../store/familyStore';
import { getTree } from '../../lib/offline/idb';
import { OfflineBanner } from './OfflineBanner';

const mockedGetTree = vi.mocked(getTree);

const validPayload = {
  treeId: 't1',
  name: 'Keluarga Uji',
  savedAt: '2026-01-01T00:00:00.000Z',
  members: [{ id: 'm1', name: 'Budi' }],
  relationships: [],
};

describe('fetchMembers fallback offline (GOAL v109 slice 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFamilyStore.setState({ offlineLoaded: false, members: [], isLoading: false, reconnectStatus: 'idle' });
  });

  afterEach(() => {
    cleanup();
  });

  it('kasus a: adapter gagal + getTree sukses, offlineLoaded true dan members dari deserialize', async () => {
    mockedGetTree.mockResolvedValue(validPayload);
    await useFamilyStore.getState().fetchMembers('t1');

    const state = useFamilyStore.getState();
    expect(state.offlineLoaded).toBe(true);
    expect(state.members).toHaveLength(1);
    expect(state.members[0].name).toBe('Budi');
    expect(state.isLoading).toBe(false);
  });

  it('kasus b1: getTree null, offlineLoaded tetap false tanpa crash', async () => {
    mockedGetTree.mockResolvedValue(null);
    await expect(useFamilyStore.getState().fetchMembers('t1')).resolves.toBeUndefined();

    const state = useFamilyStore.getState();
    expect(state.offlineLoaded).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('kasus b2: payload rusak (deserialize lempar error), tertelan senyap offlineLoaded false', async () => {
    mockedGetTree.mockResolvedValue({ tidakValid: true });
    await expect(useFamilyStore.getState().fetchMembers('t1')).resolves.toBeUndefined();

    const state = useFamilyStore.getState();
    expect(state.offlineLoaded).toBe(false);
    expect(state.members).toHaveLength(0);
  });

  it('kasus c: banner null saat offlineLoaded false, tampil teks i18n saat true', () => {
    useFamilyStore.setState({ offlineLoaded: false });
    const { container } = render(<OfflineBanner />);

    expect(container.textContent).toBe('');
    expect(screen.queryByTestId('offline-banner')).toBeNull();

    act(() => {
      useFamilyStore.setState({ offlineLoaded: true });
    });

    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(
      screen.getByText('Data dimuat dari perangkat karena koneksi terputus'),
    ).toBeTruthy();
  });
});

describe('OfflineBanner status reconnect (GOAL v111 slice 2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFamilyStore.setState({ offlineLoaded: true, reconnectStatus: 'idle' });
  });

  afterEach(() => {
    cleanup();
  });

  it("status 'refreshed': tampil baris teks refreshed", () => {
    useFamilyStore.setState({ reconnectStatus: 'refreshed' });
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByTestId('offline-reconnect-status').textContent).toBe(
      'Data pohon dimuat ulang dari server, koneksi kembali',
    );
  });

  it("status 'kept': tampil baris teks kept", () => {
    useFamilyStore.setState({ reconnectStatus: 'kept' });
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByTestId('offline-reconnect-status').textContent).toBe(
      'Data lokal lebih baru, tidak ditimpa server',
    );
  });

  it.each(['idle', 'offline_still'] as const)(
    "status '%s': tanpa baris teks tambahan",
    (status) => {
      useFamilyStore.setState({ reconnectStatus: status });
      render(<OfflineBanner />);

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      expect(screen.queryByTestId('offline-reconnect-status')).toBeNull();
    },
  );
});
