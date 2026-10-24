/**
 * @vitest-environment jsdom
 *
 * Test dialog un-merge v391 (AC7 minimal): tombol eksekusi mati sebelum
 * konfirmasi nama, eksekusi memanggil API unmerge lalu refresh members,
 * batal tidak memanggil API. Mock mengikuti pola unified-member-modal-
 * dedup.test.tsx; API merge di-mock di level adapters supaya RestAdapter
 * nyata tidak dipakai.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';
import { UnmergeMemberDialog } from '../UnmergeMemberDialog';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  unmergeMember: vi.fn(async () => ({ unmerged: true, duplicateId: 'dup-1' })),
  fetchMembers: vi.fn(async () => undefined),
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
    t: (key: string, params?: Record<string, unknown>) => {
      const teks = ambilTeks(mocks.language === 'id' ? idCommon : enCommon, key);
      if (params && typeof teks === 'string') {
        return teks.replace(/\{\{(\w+)\}\}/g, (_, nama: string) => String(params[nama] ?? ''));
      }
      return teks;
    },
    i18n: { language: mocks.language },
  }),
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (state: unknown) => unknown) =>
    selector({
      members: [{ id: 'dup-1', name: 'Budi Santoso', mergedIntoId: 'primary-1' }],
      currentFamilyTreeId: 'tree-1',
      fetchMembers: mocks.fetchMembers,
    }),
}));

vi.mock('../../../lib/adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/adapters')>();
  return {
    ...actual,
    getMergeApi: () => ({
      mergeMembers: vi.fn(),
      unmergeMember: mocks.unmergeMember,
    }),
  };
});

describe('UnmergeMemberDialog v391', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('tombol eksekusi mati sebelum nama dikonfirmasi, aktif setelah nama persis diketik', () => {
    render(<UnmergeMemberDialog isOpen onClose={vi.fn()} duplicateId="dup-1" />);
    const execute = screen.getByTestId('unmerge-execute') as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('unmerge-confirm-input'), { target: { value: 'Budi' } });
    expect((screen.getByTestId('unmerge-execute') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('unmerge-confirm-input'), { target: { value: 'Budi Santoso' } });
    expect((screen.getByTestId('unmerge-execute') as HTMLButtonElement).disabled).toBe(false);
  });

  it('eksekusi memanggil API unmerge lalu refresh members dan tampilkan sukses', async () => {
    const onUnmerged = vi.fn();
    render(<UnmergeMemberDialog isOpen onClose={vi.fn()} duplicateId="dup-1" onUnmerged={onUnmerged} />);
    fireEvent.change(screen.getByTestId('unmerge-confirm-input'), { target: { value: 'Budi Santoso' } });
    fireEvent.click(screen.getByTestId('unmerge-execute'));
    await waitFor(() => expect(mocks.unmergeMember).toHaveBeenCalledWith('tree-1', 'dup-1'));
    await waitFor(() => expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1'));
    await waitFor(() => expect(screen.getByTestId('unmerge-success')).toBeTruthy());
    expect(onUnmerged).toHaveBeenCalled();
  });

  it('batal tidak memanggil API dan menutup dialog', () => {
    const onClose = vi.fn();
    render(<UnmergeMemberDialog isOpen onClose={onClose} duplicateId="dup-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(mocks.unmergeMember).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
