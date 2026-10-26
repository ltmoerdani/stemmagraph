/**
 * @vitest-environment jsdom
 *
 * Test UI SelfConsentPanel (v409 AC4/AC5): daftar anggota diri tampil,
 * alur manage + aksi sukses memanggil postSelfConsent lalu refresh daftar,
 * error server tampil inline verbatim, scope kosong ditolak lokal, revoke
 * dan regrant lewat konfirmasi eksplisit dengan jalur Batal, panel tidak
 * tampil bila fetch gagal atau daftar kosong atau adapter nihil (mock).
 * Mock pola MergeApprovalsPanel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import { SelfConsentPanel } from '../SelfConsentPanel';

const mocks = vi.hoisted(() => ({
  listSelfConsent: vi.fn(async () => ({ members: [] as Array<Record<string, unknown>> })),
  getSelfConsent: vi.fn(async () => ({ records: [], granted: false })),
  postSelfConsent: vi.fn(async () => ({ record: { action: 'grant' }, granted: true, privacyStatus: 'shared' })),
}));

function ambilTeks(kamus: unknown, key: string): string {
  let node = kamus as Record<string, unknown> | string | undefined;
  for (const bagian of key.split('.')) {
    if (node === undefined || typeof node === 'string') return key;
    node = node[bagian] as Record<string, unknown> | string | undefined;
  }
  return typeof node === 'string' ? node : key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let base = ambilTeks(idCommon, key);
      if (opts && typeof base === 'string') {
        for (const [k, v] of Object.entries(opts)) base = base.replace(`{{${k}}}`, String(v));
      }
      return base;
    },
    i18n: { language: 'id' },
  }),
}));

vi.mock('../../../lib/i18n', () => ({ formatDate: () => '2026-10-01' }));

vi.mock('../../../lib/adapters', () => ({
  getConsentSelfApi: () => mocks.apiNull === true ? null : ({
    listSelfConsent: mocks.listSelfConsent,
    getSelfConsent: mocks.getSelfConsent,
    postSelfConsent: mocks.postSelfConsent,
  }),
}));

const ENTRY = {
  memberId: 'm-self',
  treeId: 'tree-1',
  treeName: 'Pohon Keluarga',
  granted: false,
  lastAction: null as string | null,
  lastAt: null as string | null,
};

const state = vi.hoisted(() => ({ apiNull: false }));

beforeEach(() => {
  vi.clearAllMocks();
  state.apiNull = false;
  mocks.listSelfConsent.mockResolvedValue({ members: [{ ...ENTRY }] });
  mocks.postSelfConsent.mockResolvedValue({ record: { action: 'grant' }, granted: true, privacyStatus: 'shared' });
});

afterEach(cleanup);

describe('SelfConsentPanel (v409)', () => {
  it('daftar tampil: nama pohon, status, tombol kelola', async () => {
    render(<SelfConsentPanel onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('self-consent-title')).toBeTruthy());
    expect(screen.getByTestId('self-consent-tree-name').textContent).toBe('Pohon Keluarga');
    expect(screen.getByTestId(`self-consent-entry-${ENTRY.memberId}`)).toBeTruthy();
    expect(screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)).toBeTruthy();
    expect(mocks.listSelfConsent).toHaveBeenCalledTimes(1);
  });

  it('manage lalu grant sukses: postSelfConsent dipanggil dengan scope dan daftar refresh', async () => {
    render(<SelfConsentPanel onClose={() => undefined} />);
    fireEvent.click(await waitFor(() => screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)));
    fireEvent.change(screen.getByTestId('self-consent-scope'), { target: { value: 'ekspor foto' } });
    fireEvent.change(screen.getByTestId('self-consent-note'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByTestId(`self-consent-grant-${ENTRY.memberId}`));
    await waitFor(() => expect(mocks.postSelfConsent).toHaveBeenCalledWith('m-self', 'grant', 'ekspor foto', 'ok'));
    await waitFor(() => expect(mocks.listSelfConsent).toHaveBeenCalledTimes(2));
  });

  it('scope kosong: ditolak lokal tanpa memanggil adapter', async () => {
    render(<SelfConsentPanel onClose={() => undefined} />);
    fireEvent.click(await waitFor(() => screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)));
    fireEvent.click(screen.getByTestId(`self-consent-grant-${ENTRY.memberId}`));
    await waitFor(() => expect(screen.getByTestId('self-consent-error').textContent).toContain('Cakupan wajib'));
    expect(mocks.postSelfConsent).not.toHaveBeenCalled();
  });

  it('error server tampil inline verbatim', async () => {
    mocks.postSelfConsent.mockRejectedValueOnce(new Error('CONSENT_INVALID_TRANSITION'));
    render(<SelfConsentPanel onClose={() => undefined} />);
    fireEvent.click(await waitFor(() => screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)));
    fireEvent.change(screen.getByTestId('self-consent-scope'), { target: { value: 's' } });
    fireEvent.click(screen.getByTestId(`self-consent-grant-${ENTRY.memberId}`));
    await waitFor(() => expect(screen.getByTestId('self-consent-error').textContent).toBe('CONSENT_INVALID_TRANSITION'));
  });

  it('revoke lewat konfirmasi eksplisit: Batal membatalkan, konfirmasi memanggil adapter', async () => {
    mocks.listSelfConsent.mockResolvedValue({ members: [{ ...ENTRY, granted: true }] });
    render(<SelfConsentPanel onClose={() => undefined} />);
    fireEvent.click(await waitFor(() => screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)));
    fireEvent.change(screen.getByTestId('self-consent-scope'), { target: { value: 'ekspor foto' } });
    fireEvent.click(screen.getByTestId(`self-consent-revoke-${ENTRY.memberId}`));
    expect(screen.getByTestId(`self-consent-confirm-box-${ENTRY.memberId}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`self-consent-cancel-${ENTRY.memberId}`));
    expect(screen.queryByTestId(`self-consent-confirm-box-${ENTRY.memberId}`)).toBeNull();
    expect(mocks.postSelfConsent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`self-consent-revoke-${ENTRY.memberId}`));
    fireEvent.click(screen.getByTestId(`self-consent-confirm-revoke-${ENTRY.memberId}`));
    await waitFor(() => expect(mocks.postSelfConsent).toHaveBeenCalledWith('m-self', 'revoke', expect.any(String), undefined));
  });

  it('regrant lewat konfirmasi eksplisit memanggil adapter', async () => {
    mocks.listSelfConsent.mockResolvedValue({ members: [{ ...ENTRY, granted: false }] });
    render(<SelfConsentPanel onClose={() => undefined} />);
    fireEvent.click(await waitFor(() => screen.getByTestId(`self-consent-manage-${ENTRY.memberId}`)));
    fireEvent.click(screen.getByTestId(`self-consent-regrant-${ENTRY.memberId}`));
    fireEvent.change(screen.getByTestId('self-consent-scope'), { target: { value: 'ekspor foto' } });
    fireEvent.click(screen.getByTestId(`self-consent-confirm-regrant-${ENTRY.memberId}`));
    await waitFor(() => expect(mocks.postSelfConsent).toHaveBeenCalledWith('m-self', 'regrant', expect.any(String), undefined));
  });

  it('fetch gagal: panel tidak tampil', async () => {
    mocks.listSelfConsent.mockRejectedValueOnce(new Error('boom'));
    render(<SelfConsentPanel onClose={() => undefined} />);
    await waitFor(() => expect(mocks.listSelfConsent).toHaveBeenCalled());
    expect(screen.queryByTestId('self-consent-title')).toBeNull();
  });

  it('daftar kosong: panel tidak tampil', async () => {
    mocks.listSelfConsent.mockResolvedValue({ members: [] });
    render(<SelfConsentPanel onClose={() => undefined} />);
    await waitFor(() => expect(mocks.listSelfConsent).toHaveBeenCalled());
    expect(screen.queryByTestId('self-consent-title')).toBeNull();
  });

  it('adapter nihil (mock/supabase): panel tidak tampil tanpa crash', () => {
    state.apiNull = true;
    render(<SelfConsentPanel onClose={() => undefined} />);
    expect(screen.queryByTestId('self-consent-title')).toBeNull();
  });
});
