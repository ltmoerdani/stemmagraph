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
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => {
      const dict: Record<string, string> = {
        'offline.banner': 'Data dimuat dari perangkat karena koneksi terputus',
        'offline.reconnect.refreshed': 'Data pohon dimuat ulang dari server, koneksi kembali',
        'offline.reconnect.kept': 'Data lokal lebih baru, tidak ditimpa server',
        'offline.outbox.pending': 'Perubahan lokal menunggu: {{count}}',
        'offline.outbox.send': 'Kirim ke server',
        'offline.outbox.confirm': 'Kirim {{count}} perubahan lokal ke server?',
        'offline.outbox.flushed': 'Perubahan lokal terkirim ke server',
        'offline.outbox.failed': 'Pengiriman perubahan lokal gagal, dicoba lagi nanti',
        'offline.outbox.cancel': 'Batal',
        'offline.outbox.confirm_desc': 'Perubahan lokal akan dikirim ke server dan dihapus dari perangkat setelah berhasil.',
        'offline.outbox.confirm_action': 'Kirim',
      };
      const template = dict[key] ?? key;
      if (opts && template.includes('{{count}}')) {
        return template.replaceAll('{{count}}', String(opts.count));
      }
      return template;
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
import { OutboxConfirmDialog } from './OutboxConfirmDialog';

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

describe('OfflineBanner outbox badge + dialog (GOAL v112 slice 3)', () => {
  const flushMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useFamilyStore.setState({
      offlineLoaded: true,
      reconnectStatus: 'idle',
      outboxPendingCount: 0,
      outboxConfirmOpen: false,
      outboxStatus: 'idle',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('(a) count 0: badge outbox tidak tampil', () => {
    useFamilyStore.setState({ outboxPendingCount: 0 });
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.queryByTestId('offline-outbox-badge')).toBeNull();
    expect(screen.queryByTestId('offline-outbox-flush')).toBeNull();
  });

  it('(b) count 3: badge tampil dengan teks count tepat', () => {
    useFamilyStore.setState({ outboxPendingCount: 3 });
    render(<OfflineBanner />);

    const badge = screen.getByTestId('offline-outbox-badge');
    expect(badge.textContent).toContain('Perubahan lokal menunggu: 3');
    expect(screen.getByTestId('offline-outbox-flush').textContent).toBe('Kirim ke server');
  });

  it('(c) tombol Kirim membuka dialog konfirmasi', () => {
    useFamilyStore.setState({ outboxPendingCount: 2 });
    render(
      <>
        <OfflineBanner />
        <OutboxConfirmDialog open={false} count={2} onCancel={() => {}} onConfirm={() => {}} />
      </>,
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByTestId('offline-outbox-flush'));

    const state = useFamilyStore.getState();
    expect(state.outboxConfirmOpen).toBe(true);
  });

  it('(d) batal menutup tanpa flush, fokus kembali ke pemanggil', () => {
    const onCancel = vi.fn();
    render(
      <>
        <button type="button" data-testid="opener">Pembuka</button>
        <OutboxConfirmDialog open count={2} onCancel={onCancel} onConfirm={() => {}} />
      </>,
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // Fokus awal di tombol Batal (pola APG alertdialog).
    expect(document.activeElement).toBe(screen.getByTestId('outbox-cancel'));

    fireEvent.click(screen.getByTestId('outbox-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    // Flush tidak boleh terpanggil saat batal.
    expect(flushMock).not.toHaveBeenCalled();
  });

  it('(e) Escape membatalkan dialog', () => {
    const onCancel = vi.fn();
    render(<OutboxConfirmDialog open count={1} onCancel={onCancel} onConfirm={() => {}} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('(f) setuju memanggil onConfirm (alur flush)', () => {
    const onConfirm = vi.fn();
    render(<OutboxConfirmDialog open count={4} onCancel={() => {}} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('outbox-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('(g) status flushed tampil di banner', () => {
    useFamilyStore.setState({ outboxStatus: 'flushed' });
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-outbox-status').textContent).toBe(
      'Perubahan lokal terkirim ke server',
    );
  });

  it('(h) status failed tampil di banner', () => {
    useFamilyStore.setState({ outboxStatus: 'failed' });
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-outbox-status').textContent).toBe(
      'Pengiriman perubahan lokal gagal, dicoba lagi nanti',
    );
  });
});
