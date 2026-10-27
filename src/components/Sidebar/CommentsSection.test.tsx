/**
 * @vitest-environment jsdom
 *
 * Test komponen CommentsSection (GOAL Stemmagraph v416, AC5).
 * Cakupan: hide-on-failure saat API null, render daftar, optimistic add
 * sukses/gagal, visibilitas tombol hapus per role, dialog hapus APG
 * (fokus awal Batal, sukses, gagal), dan Escape menutup dialog.
 * Pola mock mengikuti MergeApprovalsPanel.test.tsx (v392 AC8c).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../lib/i18n/locales/id/common.json';
import { CommentsSection } from './CommentsSection';
import type { CommentItem } from '../../lib/adapters/types';

const mocks = vi.hoisted(() => ({
  listComments: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
  getCommentApi: vi.fn(),
  authUser: vi.fn(),
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

vi.mock('../../lib/adapters', () => ({
  getCommentApi: mocks.getCommentApi,
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: mocks.authUser() }),
}));

function buatKomentar(partial: Partial<CommentItem> & { id: string }): CommentItem {
  return {
    memberId: 'member-1',
    userId: 'user-1',
    body: 'Isi komentar',
    createdAt: '2026-10-27T10:00:00Z',
    ...partial,
  };
}

const KOMENTAR_SAYA = buatKomentar({ id: 'c1', userName: 'Budi', body: 'Komentar milik Budi' });
const KOMENTAR_ORANG = buatKomentar({ id: 'c2', userId: 'user-2', userName: 'Siti', body: 'Komentar milik Siti' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCommentApi.mockReturnValue({
    listComments: mocks.listComments,
    postComment: mocks.postComment,
    deleteComment: mocks.deleteComment,
  });
  mocks.authUser.mockReturnValue({
    id: 'user-1',
    role: 'member',
    email: 'budi@example.test',
    name: 'Budi',
    createdAt: '2026-01-01T00:00:00Z',
  });
  mocks.listComments.mockResolvedValue({ comments: [], nextCursor: null });
});

afterEach(cleanup);

async function renderDenganKomentar(...komentar: CommentItem[]) {
  mocks.listComments.mockResolvedValue({ comments: komentar, nextCursor: null });
  render(<CommentsSection memberId="member-1" />);
  await waitFor(() => expect(mocks.listComments).toHaveBeenCalledWith('member-1'));
  if (komentar.length > 0) {
    await screen.findByText(komentar[0].body, { selector: 'p' });
  }
}

describe('CommentsSection (GOAL v416 AC5)', () => {
  it('API null: section tidak render (hide-on-failure)', () => {
    mocks.getCommentApi.mockReturnValue(null);
    const { container } = render(<CommentsSection memberId="member-1" />);
    expect(container.firstChild).toBeNull();
    expect(mocks.listComments).not.toHaveBeenCalled();
  });

  it('fetch awal gagal: section disembunyikan', async () => {
    mocks.listComments.mockRejectedValue(new Error('boom'));
    const { container } = render(<CommentsSection memberId="member-1" />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('daftar komentar tampil: nama dan body dari listComments', async () => {
    await renderDenganKomentar(KOMENTAR_SAYA, KOMENTAR_ORANG);
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.getByText('Komentar milik Budi')).toBeTruthy();
    expect(screen.getByText('Siti')).toBeTruthy();
    expect(screen.getByText('Komentar milik Siti')).toBeTruthy();
  });

  it('submit sukses: komentar optimis muncul sebelum resolve, diganti data server, draft kosong', async () => {
    let resolvePost!: (v: { comment: CommentItem }) => void;
    mocks.postComment.mockReturnValue(
      new Promise<{ comment: CommentItem }>((res) => {
        resolvePost = res;
      }),
    );

    render(<CommentsSection memberId="member-1" />);
    const textarea = await screen.findByPlaceholderText('Tulis komentar untuk anggota ini');

    fireEvent.change(textarea, { target: { value: 'Komentar baru optimis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));

    // Fase optimis: sebelum postComment resolve, entri sementara sudah tampil.
    expect(screen.getByText('Komentar baru optimis', { selector: 'p' })).toBeTruthy();

    resolvePost({ comment: buatKomentar({ id: 'c-server', body: 'Dari server', userName: 'Budi' }) });

    await waitFor(() => expect(screen.getByText('Dari server', { selector: 'p' })).toBeTruthy());
    expect(screen.queryByText('Komentar baru optimis', { selector: 'p' })).toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe('');
    expect(mocks.postComment).toHaveBeenCalledWith('member-1', 'Komentar baru optimis');
  });

  it('submit gagal: komentar optimis di-rollback, error inline tampil', async () => {
    mocks.postComment.mockRejectedValue(new Error('offline'));

    await renderDenganKomentar(KOMENTAR_SAYA);
    const textarea = screen.getByPlaceholderText('Tulis komentar untuk anggota ini');

    fireEvent.change(textarea, { target: { value: 'Coba kirim gagal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));

    expect(screen.getByText('Coba kirim gagal', { selector: 'p' })).toBeTruthy();

    await waitFor(() => expect(screen.getByText('Komentar gagal terkirim. Coba lagi.')).toBeTruthy());
    // Draft sengaja dipertahankan saat gagal agar user tidak kehilangan tulisan;
    // yang di-rollback hanya entri optimis di daftar.
    expect(screen.queryByText('Coba kirim gagal', { selector: 'p' })).toBeNull();
    expect(screen.getByText('Komentar milik Budi')).toBeTruthy();
  });

  it('tombol hapus: milik sendiri ada, milik orang lain tidak ada (role member)', async () => {
    await renderDenganKomentar(KOMENTAR_SAYA, KOMENTAR_ORANG);
    const tombol = screen.getAllByLabelText('Hapus komentar ini');
    expect(tombol.length).toBe(1);
    // Satu-satunya tombol ada di li komentar milik sendiri (c1).
    expect(tombol[0].closest('li')?.textContent).toContain('Komentar milik Budi');
  });

  it('tombol hapus: role owner melihat tombol di semua komentar', async () => {
    mocks.authUser.mockReturnValue({
      id: 'user-9',
      role: 'owner',
      email: 'owner@example.test',
      name: 'Owner',
      createdAt: '2026-01-01T00:00:00Z',
    });
    await renderDenganKomentar(KOMENTAR_SAYA, KOMENTAR_ORANG);
    expect(screen.getAllByLabelText('Hapus komentar ini').length).toBe(2);
  });

  it('tombol hapus: user null tidak melihat tombol apa pun', async () => {
    mocks.authUser.mockReturnValue(null);
    await renderDenganKomentar(KOMENTAR_SAYA, KOMENTAR_ORANG);
    expect(screen.queryByLabelText('Hapus komentar ini')).toBeNull();
  });

  it('hapus sukses: dialog alertdialog, fokus awal di Batal, entri hilang, status sukses tampil', async () => {
    mocks.deleteComment.mockResolvedValue(undefined);
    await renderDenganKomentar(KOMENTAR_SAYA);

    fireEvent.click(screen.getByLabelText('Hapus komentar ini'));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Batal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));

    await waitFor(() => expect(mocks.deleteComment).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Komentar milik Budi')).toBeNull());
    expect(screen.getByText('Komentar telah dihapus.')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('hapus gagal: deleteComment reject, komentar tetap ada, error inline tampil', async () => {
    mocks.deleteComment.mockRejectedValue(new Error('forbidden'));
    await renderDenganKomentar(KOMENTAR_SAYA);

    fireEvent.click(screen.getByLabelText('Hapus komentar ini'));
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));

    await waitFor(() => expect(screen.getByText('Komentar gagal terkirim. Coba lagi.')).toBeTruthy());
    expect(screen.getByText('Komentar milik Budi')).toBeTruthy();
    // Perilaku komponen: gagal hapus tidak menutup dialog agar user bisa mencoba lagi.
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('Escape di dialog menutup tanpa memanggil deleteComment', async () => {
    await renderDenganKomentar(KOMENTAR_SAYA);

    fireEvent.click(screen.getByLabelText('Hapus komentar ini'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mocks.deleteComment).not.toHaveBeenCalled();
    expect(screen.getByText('Komentar milik Budi')).toBeTruthy();
  });
});
