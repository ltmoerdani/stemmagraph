/**
 * @vitest-environment jsdom
 *
 * GOAL v146 fase ii: wiring peringatan duplikat non-blocking MemberEditModal.
 * Store dimuat dinamis di modal (import('../../../store/familyStore')), jadi
 * mock cukup menyediakan useFamilyStore.getState().members.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';

const mockGetConsent = vi.fn();
const mockMembers: FamilyMember[] = [];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../lib/adapters', () => ({
  getConsentApi: () => ({ getConsent: mockGetConsent, postConsent: vi.fn() }),
}));

vi.mock('../../../../store/familyStore', () => ({
  useFamilyStore: {
    getState: () => ({ members: mockMembers }),
  },
}));

const { MemberEditModal } = await import('../MemberEditModal');

function makeMember(overrides: Partial<FamilyMember>): FamilyMember {
  return {
    id: 'x',
    name: 'Unnamed Person',
    birthDate: '1990-01-01',
    birthPlace: 'Bandung',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...overrides,
  };
}

const selfMember = makeMember({ id: 'm1', name: 'Budi Santoso' });

beforeEach(() => {
  cleanup();
  mockGetConsent.mockReset();
  mockGetConsent.mockResolvedValue({ granted: true, records: [] });
  mockMembers.splice(0, mockMembers.length, selfMember);
});

describe('MemberEditModal peringatan duplikat (v146-ii)', () => {
  it('warning muncul bila ada pasangan dengan skor >= 80', async () => {
    mockMembers.push(makeMember({ id: 'm2', name: 'Budi Santoso', birthDate: '1990-05-05' }));

    const { queryByTestId } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    await waitFor(() => {
      expect(queryByTestId('dedup-warning')).not.toBeNull();
    });
  });

  it('tidak ada warning bila tidak ada pasangan mirip', async () => {
    mockMembers.push(makeMember({ id: 'm3', name: 'Citra Dewi', birthDate: '1985-03-10', gender: 'female' }));

    const { queryByTestId } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    await waitFor(() => {
      expect(mockGetConsent).toHaveBeenCalled();
    });
    expect(queryByTestId('dedup-warning')).toBeNull();
  });

  it('maksimal 3 baris warning ditampilkan', async () => {
    mockMembers.push(
      makeMember({ id: 'm2', name: 'Budi Santoso' }),
      makeMember({ id: 'm3', name: 'Budi Santoso' }),
      makeMember({ id: 'm4', name: 'Budi Santoso' }),
      makeMember({ id: 'm5', name: 'Budi Santoso' }),
    );

    const { queryAllByTestId } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    await waitFor(() => {
      expect(queryAllByTestId('dedup-warning-row').length).toBeGreaterThan(0);
    });
    expect(queryAllByTestId('dedup-warning-row')).toHaveLength(3);
  });

  it('label alasan ter-render pada baris warning', async () => {
    mockMembers.push(makeMember({ id: 'm2', name: 'Budi Santoso' }));

    const { queryByTestId, getByText } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    await waitFor(() => {
      expect(queryByTestId('dedup-warning-row')).not.toBeNull();
    });
    expect(getByText('Nama depan sama')).not.toBeNull();
    expect(getByText('Nama belakang sama')).not.toBeNull();
    expect(getByText('Tahun lahir sama')).not.toBeNull();
  });

  it('save tetap terpanggil saat warning tampil (non-blocking)', async () => {
    mockMembers.push(makeMember({ id: 'm2', name: 'Budi Santoso' }));
    const onSave = vi.fn();

    const { queryByTestId, getByRole } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={onSave} />,
    );

    await waitFor(() => {
      expect(queryByTestId('dedup-warning')).not.toBeNull();
    });

    fireEvent.click(getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it('warning hilang bila nama diubah menjadi unik', async () => {
    mockMembers.push(makeMember({ id: 'm2', name: 'Budi Santoso' }));

    const { queryByTestId, container } = render(
      <MemberEditModal member={selfMember} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    await waitFor(() => {
      expect(queryByTestId('dedup-warning')).not.toBeNull();
    });

    const nameInput = container.querySelector('#member-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Zulkarnain Wirya' } });

    await waitFor(() => {
      expect(queryByTestId('dedup-warning')).toBeNull();
    });
  });
});
