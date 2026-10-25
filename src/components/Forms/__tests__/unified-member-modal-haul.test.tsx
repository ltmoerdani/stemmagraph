/**
 * @vitest-environment jsdom
 *
 * Test wiring input tanggal haul manual v393 (AC5/AC6) di
 * UnifiedMemberModal: input haul hanya tampil untuk anggota wafat,
 * anggota hidup tidak punya input, dan submit membawa haulOverrideDate
 * ke store/adapter. Mock mengikuti pola unified-member-modal-dedup.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';
import { UnifiedMemberModal } from '../UnifiedMemberModal';
import type { FamilyMember } from '../../../types/family';

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
    getMergeApi: () => null,
    getChangeReviewApi: () => null,
  };
});

function anggota(partial: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  return {
    birthDate: '',
    gender: 'male',
    isAlive: false,
    generation: 1,
    maritalStatus: 'widowed',
    ...partial,
  } as FamilyMember;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addMember.mockImplementation(async () => 'new-1');
  mocks.suggestMargaValues.mockReturnValue([]);
  mocks.checkDuplicateCandidates.mockResolvedValue({ candidates: [] });
});

afterEach(cleanup);

function isiNamaDanWafat(alihWafat = true): void {
  fireEvent.change(screen.getByLabelText(/nama lengkap|full name|nama/i), {
    target: { value: 'Opung Simanjuntak' },
  });
  if (alihWafat) {
    fireEvent.click(screen.getByText(/deceased|wafat/i));
  }
}

describe('UnifiedMemberModal input haul manual v393', () => {
  it('anggota hidup: input haul tidak tampil', () => {
    render(<UnifiedMemberModal isOpen={true} editingMember={undefined} onClose={() => {}} />);
    expect(screen.queryByLabelText(ambilTeks(idCommon, 'memberForm.haulOverrideDate'))).toBeNull();
  });

  it('anggota wafat: input haul tampil dengan label i18n dan hint', () => {
    render(<UnifiedMemberModal isOpen={true} editingMember={undefined} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/deceased|wafat/i));
    const input = screen.getByLabelText(ambilTeks(idCommon, 'memberForm.haulOverrideDate'));
    expect(input).toBeTruthy();
    expect(screen.getByText(ambilTeks(idCommon, 'memberForm.haulOverrideHint'))).toBeTruthy();
  });

  it('edit anggota wafat ber-override: nilai terisi di form, submit membawa haulOverrideDate ke updateMember', async () => {
    render(
      <UnifiedMemberModal
        isOpen={true}
        editingMember={anggota({ id: 'm-1', name: 'Opung', deathDate: '2020-05-10', haulOverrideDate: '2026-11-15' })}
        onClose={() => {}}
      />,
    );
    const input = screen.getByLabelText(ambilTeks(idCommon, 'memberForm.haulOverrideDate')) as HTMLInputElement;
    expect(input.value).toBe('2026-11-15');
    fireEvent.change(input, { target: { value: '2027-11-14' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan|save|update|tambah|add/i }));
    await waitFor(() => {
      expect(mocks.updateMember).toHaveBeenCalled();
    });
    const payload = mocks.updateMember.mock.calls[0]?.[1] as { haulOverrideDate?: string };
    expect(payload.haulOverrideDate).toBe('2027-11-14');
  });

  it('kosongkan input lalu submit: updateMember tidak membawa haulOverrideDate', async () => {
    render(
      <UnifiedMemberModal
        isOpen={true}
        editingMember={anggota({ id: 'm-2', name: 'Nai', deathDate: '2019-01-20', haulOverrideDate: '2025-11-15' })}
        onClose={() => {}}
      />,
    );
    const input = screen.getByLabelText(ambilTeks(idCommon, 'memberForm.haulOverrideDate')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan|save|update|tambah|add/i }));
    await waitFor(() => {
      expect(mocks.updateMember).toHaveBeenCalled();
    });
    const payload = mocks.updateMember.mock.calls[0]?.[1] as { haulOverrideDate?: string };
    expect(payload.haulOverrideDate).toBeUndefined();
  });

  it('create anggota wafat dengan tanggal haul: addMember membawa haulOverrideDate', async () => {
    render(<UnifiedMemberModal isOpen={true} editingMember={undefined} onClose={() => {}} />);
    isiNamaDanWafat();
    fireEvent.change(screen.getByLabelText(ambilTeks(idCommon, 'memberForm.haulOverrideDate')), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /simpan|save|update|tambah|add/i }));
    await waitFor(() => {
      expect(mocks.addMember).toHaveBeenCalled();
    });
    const payload = mocks.addMember.mock.calls[0]?.[0] as { haulOverrideDate?: string; isAlive: boolean };
    expect(payload.isAlive).toBe(false);
    expect(payload.haulOverrideDate).toBe('2026-12-01');
  });
});
