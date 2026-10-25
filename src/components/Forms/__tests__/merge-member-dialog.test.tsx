/**
 * @vitest-environment jsdom
 *
 * Test wiring dialog merge v390 (AC5/AC7): tombol mati sebelum
 * confirmName cocok, eksekusi memanggil API merge lalu create, batal
 * nihil. Mock pola unified-member-modal-dedup.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import { MergeMemberDialog } from '../MergeMemberDialog';

const mocks = vi.hoisted(() => ({
  addMember: vi.fn(async () => 'new-1'),
  fetchMembers: vi.fn(async () => undefined),
  mergeMember: vi.fn(async () => ({ merged: true, primaryId: 'pri-1' } as { merged: boolean; primaryId?: string; needsApproval?: boolean; approvalId?: string; reasons?: unknown[] })),
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

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (state: unknown) => unknown) =>
    selector({
      members: [{ id: 'pri-1', name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }],
      relationships: [
        { id: 'r1', memberId: 'pri-1', relatedId: 'w-1', type: 'spouse' },
        { id: 'r2', memberId: 'w-2', relatedId: 'pri-1', type: 'parent' },
      ],
      currentFamilyTreeId: 'tree-1',
      addMember: mocks.addMember,
      fetchMembers: mocks.fetchMembers,
    }),
}));

vi.mock('../../../lib/adapters', () => ({
  getMergeApi: () => ({ mergeMember: mocks.mergeMember }),
}));

describe('MergeMemberDialog (v390)', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tampil dengan ringkasan side-by-side dan tombol mati sebelum confirmName cocok', () => {
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('merge-dialog-title')).toBeTruthy();
    expect(screen.getByTestId('merge-side-duplicate').textContent).toContain('Andi');
    expect(screen.getByTestId('merge-side-primary').textContent).toContain('Andi');
    const execute = screen.getByTestId('merge-execute') as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
  });

  it('confirmName salah: tombol tetap mati', () => {
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('merge-confirm-input'), { target: { value: 'Andes' } });
    const execute = screen.getByTestId('merge-execute') as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
  });

  it('confirmName cocok: eksekusi memanggil create lalu API merge, sukses tampil dan tree di-refresh', async () => {
    const onMerged = vi.fn();
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={vi.fn()}
        onMerged={onMerged}
      />,
    );
    fireEvent.change(screen.getByTestId('merge-confirm-input'), { target: { value: 'Andi' } });
    const execute = screen.getByTestId('merge-execute') as HTMLButtonElement;
    expect(execute.disabled).toBe(false);
    fireEvent.click(execute);
    await waitFor(() => expect(mocks.mergeMember).toHaveBeenCalledTimes(1));
    expect(mocks.mergeMember).toHaveBeenCalledWith('tree-1', 'new-1', { targetId: 'pri-1', confirmName: 'Andi' });
    expect(mocks.addMember).toHaveBeenCalledTimes(1);
    expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1');
    expect(onMerged).toHaveBeenCalledWith('pri-1');
    expect(screen.getByTestId('merge-success')).toBeTruthy();
  });

  it('batal: onClose dipanggil, API tidak disentuh', () => {
    const onClose = vi.fn();
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('merge-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.mergeMember).not.toHaveBeenCalled();
  });

  it('API gagal: pesan error tampil, tanpa sukses', async () => {
    mocks.mergeMember.mockRejectedValueOnce(new Error('ALREADY_MERGED'));
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('merge-confirm-input'), { target: { value: 'Andi' } });
    fireEvent.click(screen.getByTestId('merge-execute'));
    await waitFor(() => expect(screen.getByTestId('merge-error')).toBeTruthy());
    expect(screen.getByTestId('merge-error').textContent).toContain('ALREADY_MERGED');
  });

  // v392 AC6: server menjawab 202 NEEDS_APPROVAL; adapter memetakan ke
  // hasil union merged:false + reasons. Dialog wajib menampilkan status
  // antrian + daftar alasan, tanpa sukses, tanpa error, tanpa onMerged.
  it('v392 202 NEEDS_APPROVAL: status antrian + alasan tampil, tanpa sukses dan tanpa onMerged', async () => {
    const onMerged = vi.fn();
    const onClose = vi.fn();
    mocks.mergeMember.mockResolvedValueOnce({
      merged: false,
      needsApproval: true,
      approvalId: 'apr-1',
      reasons: [
        { code: 'RELATION_REWIRE', actual: 5, threshold: 4 },
        { code: 'GENERATION_BOTH_CONNECTED', actual: 1, threshold: 1 },
      ],
    });
    render(
      <MergeMemberDialog
        isOpen
        entryDraft={{ name: 'Andi', birthDate: '1980-01-01', marga: 'Siregar' }}
        primaryId="pri-1"
        onClose={onClose}
        onMerged={onMerged}
      />,
    );
    fireEvent.change(screen.getByTestId('merge-confirm-input'), { target: { value: 'Andi' } });
    fireEvent.click(screen.getByTestId('merge-execute'));
    const queued = await waitFor(() => screen.getByTestId('merge-approval-queued'));
    expect(queued.textContent).toContain('Alasan merge masuk antrian');
    expect(screen.getByTestId('approval-reason-RELATION_REWIRE').textContent).toContain('5');
    expect(screen.getByTestId('approval-reason-GENERATION_BOTH_CONNECTED')).toBeTruthy();
    expect(screen.queryByTestId('merge-success')).toBeNull();
    expect(screen.queryByTestId('merge-error')).toBeNull();
    expect(onMerged).not.toHaveBeenCalled();
    expect(mocks.fetchMembers).not.toHaveBeenCalled();
    // Tutup dari status antrian memanggil onClose dan reset state dialog.
    fireEvent.click(screen.getByTestId('merge-queued-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
