/**
 * @vitest-environment jsdom
 *
 * Test wiring peringatan duplikat v388 di UnifiedMemberModal (AC3):
 * peringatan tampil saat kandidat ada, Lanjut memanggil create, Batal
 * tidak memanggil, tanpa kandidat alur create langsung jalan.
 * Mock mengikuti pola unified-member-modal-marga.test.tsx; API duplikat
 * di-mock di level adapters supaya RestAdapter nyata tidak dipakai.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';
import { UnifiedMemberModal } from '../UnifiedMemberModal';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  suggestMargaValues: vi.fn<[], string[]>(),
  addMember: vi.fn(async () => 'new-1'),
  updateMember: vi.fn(),
  addMemberWithRelationship: vi.fn(),
  createChangeProposal: vi.fn(),
  checkDuplicateCandidates: vi.fn(),
}));

vi.mock('../../../lib/genealogy/leksikon-bank', () => ({
  suggestMargaValues: mocks.suggestMargaValues,
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
    t: (key: string) => ambilTeks(mocks.language === 'id' ? idCommon : enCommon, key),
    i18n: { language: mocks.language },
  }),
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: () => ({
    addMember: mocks.addMember,
    updateMember: mocks.updateMember,
    addMemberWithRelationship: mocks.addMemberWithRelationship,
    currentFamilyTreeId: 'tree-1',
    selectedMember: null,
    setSelectedMember: vi.fn(),
  }),
}));

vi.mock('../../../store/dashboardStore', () => ({
  useDashboardStore: (selector: (state: unknown) => unknown) =>
    selector({ familyTrees: [{ id: 'tree-1', role: 'owner' }] }),
}));

vi.mock('../../../lib/adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/adapters')>();
  return {
    ...actual,
    getDuplicateCheckApi: () => ({
      checkDuplicateCandidates: mocks.checkDuplicateCandidates,
    }),
  };
});

function renderCreateModal(): void {
  render(
    <UnifiedMemberModal
      isOpen={true}
      editingMember={undefined}
      onClose={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addMember.mockImplementation(async () => 'new-1');
  mocks.suggestMargaValues.mockReturnValue([]);
  mocks.checkDuplicateCandidates.mockResolvedValue({ candidates: [] });
});

afterEach(cleanup);

function bukaDanSubmit(): void {
  fireEvent.change(screen.getByLabelText(/nama lengkap|full name|nama/i), {
    target: { value: 'Andi Sitompul' },
  });
  fireEvent.click(screen.getByRole('button', { name: /simpan|save|tambah|add/i }));
}

describe('UnifiedMemberModal peringatan duplikat v388', () => {
  it('tanpa kandidat, submit langsung create tanpa panel peringatan', async () => {
    renderCreateModal();
    bukaDanSubmit();
    await waitFor(() => {
      expect(mocks.addMember).toHaveBeenCalled();
    });
    expect(mocks.checkDuplicateCandidates).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('duplicate-warning')).toBeNull();
  });

  it('kandidat ada: panel peringatan tampil, create tertahan', async () => {
    renderCreateModal();
    mocks.checkDuplicateCandidates.mockResolvedValue({
      candidates: [{ memberId: 'm1', score: 80, reasons: ['EXACT_NAME', 'SAME_MARGA'] }],
    });
    bukaDanSubmit();
    await waitFor(() => {
      expect(screen.getByTestId('duplicate-warning')).toBeTruthy();
    });
    expect(mocks.addMember).not.toHaveBeenCalled();
  });

  it('Lanjut mengacknowledge lalu create jalan', async () => {
    renderCreateModal();
    mocks.checkDuplicateCandidates.mockResolvedValue({
      candidates: [{ memberId: 'm1', score: 80, reasons: ['EXACT_NAME'] }],
    });
    bukaDanSubmit();
    await waitFor(() => {
      expect(screen.getByTestId('duplicate-warning')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: ambilTeks(idCommon, 'dedup.entry.proceed') }));
    await waitFor(() => {
      expect(mocks.addMember).toHaveBeenCalled();
    });
  });

  it('Batal menutup panel tanpa create', async () => {
    renderCreateModal();
    mocks.checkDuplicateCandidates.mockResolvedValue({
      candidates: [{ memberId: 'm1', score: 80, reasons: ['EXACT_NAME'] }],
    });
    bukaDanSubmit();
    await waitFor(() => {
      expect(screen.getByTestId('duplicate-warning')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: ambilTeks(idCommon, 'dedup.entry.cancel') }));
    expect(mocks.addMember).not.toHaveBeenCalled();
  });
});
