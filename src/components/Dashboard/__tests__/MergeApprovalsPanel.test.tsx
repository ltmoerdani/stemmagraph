/**
 * @vitest-environment jsdom
 *
 * Test UI MergeApprovalsPanel (v392 AC8c): daftar PENDING dengan alasan,
 * alur approve dua langkah memanggil decideMergeApproval lalu refresh,
 * alur reject sama, error server tampil inline, queue kosong. Mock pola
 * merge-member-dialog.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import { MergeApprovalsPanel } from '../MergeApprovalsPanel';

const mocks = vi.hoisted(() => ({
  listMergeApprovals: vi.fn(async () => []),
  decideMergeApproval: vi.fn(async () => ({ approvalId: 'apr-1', status: 'EXECUTED' as const, deciderId: 'u-2', decidedAt: '2026-10-25T00:00:00Z' })),
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

vi.mock('../../../lib/i18n', () => ({ formatDate: () => '2026-11-01' }));

vi.mock('../../../lib/adapters', () => ({
  getMergeApi: () => ({
    listMergeApprovals: mocks.listMergeApprovals,
    decideMergeApproval: mocks.decideMergeApproval,
  }),
}));

const PENDING = {
  id: 'apr-1',
  treeId: 'tree-1',
  primaryId: 'pri-1',
  duplicateId: 'dup-1',
  reasons: [
    { code: 'RELATION_REWIRE' as const, actual: 5, threshold: 4 },
    { code: 'FACTS_MOVED' as const, actual: 7, threshold: 6 },
  ],
  status: 'PENDING' as const,
  requesterId: 'user-9',
  deciderId: null,
  createdAt: '2026-10-25T00:00:00Z',
  decidedAt: null,
  expiresAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listMergeApprovals.mockResolvedValue([]);
});

afterEach(cleanup);

describe('MergeApprovalsPanel (v392 AC8c)', () => {
  it('queue kosong: pesan kosong tampil', async () => {
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.listMergeApprovals).toHaveBeenCalledWith('tree-1', { status: 'PENDING' }));
    await waitFor(() => expect(screen.getByTestId('merge-approvals-empty')).toBeTruthy());
  });

  it('approval PENDING tampil dengan alasan dan dua aksi eksplisit', async () => {
    mocks.listMergeApprovals.mockResolvedValue([PENDING]);
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    const card = await waitFor(() => screen.getByTestId('merge-approval-apr-1'));
    expect(card.textContent).toContain('user-9');
    expect(screen.getByTestId('panel-reason-RELATION_REWIRE').textContent).toContain('5');
    expect(screen.getByTestId('panel-reason-FACTS_MOVED').textContent).toContain('7');
    expect(screen.getByTestId('approval-approve-apr-1')).toBeTruthy();
    expect(screen.getByTestId('approval-reject-apr-1')).toBeTruthy();
  });

  it('approve dua langkah: konfirmasi lalu decide approve, antrian di-refresh', async () => {
    mocks.listMergeApprovals.mockResolvedValue([PENDING]);
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId('approval-approve-apr-1'));
    fireEvent.click(screen.getByTestId('approval-approve-apr-1'));
    const box = await waitFor(() => screen.getByTestId('approval-confirm-box-apr-1'));
    expect(box.textContent).toContain('Setujui merge berisiko');
    fireEvent.click(screen.getByTestId('approval-confirm-approve-apr-1'));
    await waitFor(() => expect(mocks.decideMergeApproval).toHaveBeenCalledWith('tree-1', 'apr-1', 'approve'));
    await waitFor(() => expect(mocks.listMergeApprovals).toHaveBeenCalledTimes(2));
  });

  it('reject dua langkah: konfirmasi lalu decide reject', async () => {
    mocks.listMergeApprovals.mockResolvedValue([PENDING]);
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId('approval-reject-apr-1'));
    fireEvent.click(screen.getByTestId('approval-reject-apr-1'));
    await waitFor(() => screen.getByTestId('approval-confirm-box-apr-1'));
    fireEvent.click(screen.getByTestId('approval-confirm-reject-apr-1'));
    await waitFor(() => expect(mocks.decideMergeApproval).toHaveBeenCalledWith('tree-1', 'apr-1', 'reject'));
  });

  it('server menolak (422 self-approval): pesan error inline tampil', async () => {
    mocks.listMergeApprovals.mockResolvedValue([PENDING]);
    mocks.decideMergeApproval.mockRejectedValueOnce(
      new Error('Pemohon merge tidak boleh memutuskan sendiri; minta owner atau editor lain'),
    );
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    await waitFor(() => screen.getByTestId('approval-approve-apr-1'));
    fireEvent.click(screen.getByTestId('approval-approve-apr-1'));
    await waitFor(() => screen.getByTestId('approval-confirm-box-apr-1'));
    fireEvent.click(screen.getByTestId('approval-confirm-approve-apr-1'));
    const err = await waitFor(() => screen.getByTestId('merge-approvals-error'));
    expect(err.textContent).toContain('tidak boleh memutuskan sendiri');
  });

  it('fetch gagal: pesan loadFailed tampil', async () => {
    mocks.listMergeApprovals.mockRejectedValueOnce(new Error('403'));
    render(<MergeApprovalsPanel treeId="tree-1" treeName="Keluarga Besar" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('merge-approvals-title')).toBeTruthy());
    await waitFor(() => expect(document.body.textContent).toContain('Gagal memuat antrian persetujuan.'));
  });
});
