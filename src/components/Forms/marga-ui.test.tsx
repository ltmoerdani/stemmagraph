/**
 * @vitest-environment jsdom
 *
 * Test UI marga v242i-ui-tests: input marga di UnifiedMemberModal (label,
 * helper, prefill, trim, nilai kosong) dan tampilan kondisional di
 * MemberDetailSidebar. Teks i18n dibaca dari locale asli lewat mock
 * react-i18next; store dan adapter di-mock. Asersi fungsional saja.
 *
 * Kontrak komponen (baca first-hand dari UnifiedMemberModal.tsx): modal tanpa
 * callback onCreate/onUpdate, jalur tambah memanggil addMember store, jalur
 * edit pemilik memanggil updateMember store. Label nama di modal hardcoded
 * "Full Name" (bukan lewat i18n), tombol submit "SAVE" atau "UPDATE".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import idCommon from '../../lib/i18n/locales/id/common.json';
import enCommon from '../../lib/i18n/locales/en/common.json';
import type { FamilyMember } from '../../types/family';
import { UnifiedMemberModal } from './UnifiedMemberModal';
import { MemberDetailSidebar } from '../Sidebar/MemberDetailSidebar';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  selectedMember: null as FamilyMember | null,
  addMember: vi.fn(),
  updateMember: vi.fn(),
  addMemberWithRelationship: vi.fn(),
  createChangeProposal: vi.fn(),
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

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: () => ({
    addMember: mocks.addMember,
    updateMember: mocks.updateMember,
    addMemberWithRelationship: mocks.addMemberWithRelationship,
    currentFamilyTreeId: 'tree-1',
    selectedMember: mocks.selectedMember,
    setSelectedMember: vi.fn(),
  }),
}));

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: (selector: (state: unknown) => unknown) =>
    selector({ familyTrees: [{ id: 'tree-1', role: 'owner' }] }),
}));

vi.mock('../../lib/adapters', () => ({
  getChangeReviewApi: () => ({ createChangeProposal: mocks.createChangeProposal }),
}));

vi.mock('../../hooks/useKinshipGraph', () => ({
  useKinshipGraph: () => ({ graph: null, selectedMember: null }),
}));

function anggota(override: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: 'm1',
    name: 'Anak Uji',
    gender: 'male',
    birthDate: '1990-01-01',
    isAlive: true,
    maritalStatus: 'single',
    generation: 1,
    ...override,
  } as unknown as FamilyMember;
}

function isiNamaDanSubmit(nama = 'Budi') {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: nama } });
  fireEvent.submit(document.querySelector('form')!);
}

beforeEach(() => {
  mocks.language = 'id';
  mocks.selectedMember = null;
  mocks.addMember.mockResolvedValue('m-baru');
  mocks.updateMember.mockResolvedValue(undefined);
  mocks.addMemberWithRelationship.mockResolvedValue('m-baru');
  mocks.createChangeProposal.mockResolvedValue({ id: 'p1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('marga UI: UnifiedMemberModal', () => {
  it('1. mode tambah menampilkan label marga dan helper dari i18n', () => {
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(screen.getByLabelText(idCommon.form.margaLabel)).toBeTruthy();
    expect(screen.getByText(idCommon.form.margaHelper)).toBeTruthy();
    expect(idCommon.form.margaHelper).toContain('marga');
    expect(idCommon.form.margaHelper).toContain('merga');
    expect(idCommon.form.margaHelper).toContain('morga');
    expect(idCommon.form.margaHelper).toContain('fam');
  });

  it('2. locale en memakai label Clan name', () => {
    mocks.language = 'en';
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(screen.getByLabelText(enCommon.form.margaLabel)).toBeTruthy();
    expect(enCommon.form.margaLabel).toBe('Clan name');
  });

  it('3. mode edit prefilled dengan nilai marga editingMember', () => {
    render(
      <UnifiedMemberModal isOpen onClose={vi.fn()} editingMember={anggota({ marga: 'Simanjuntak' })} />,
    );
    const input = screen.getByLabelText(idCommon.form.margaLabel) as HTMLInputElement;
    expect(input.value).toBe('Simanjuntak');
  });

  it('4. mode tambah tanpa marga: input mulai kosong', () => {
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    const input = screen.getByLabelText(idCommon.form.margaLabel) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('5. submit tambah dengan marga ber-spasi: dikirim trim', async () => {
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(idCommon.form.margaLabel), {
      target: { value: '  Marga X  ' },
    });
    isiNamaDanSubmit();
    await waitFor(() => expect(mocks.addMember).toHaveBeenCalled());
    const payload = mocks.addMember.mock.calls[0][0] as FamilyMember;
    expect(payload.marga).toBe('Marga X');
  });

  it('6. submit tambah marga kosong: field marga undefined', async () => {
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    isiNamaDanSubmit();
    await waitFor(() => expect(mocks.addMember).toHaveBeenCalled());
    const payload = mocks.addMember.mock.calls[0][0] as FamilyMember;
    expect(payload.marga).toBeUndefined();
  });

  it('7. submit edit pemilik dengan marga kosong: updateMember menerima undefined', async () => {
    render(
      <UnifiedMemberModal isOpen onClose={vi.fn()} editingMember={anggota({ marga: 'Lama' })} />,
    );
    fireEvent.change(screen.getByLabelText(idCommon.form.margaLabel), { target: { value: '   ' } });
    isiNamaDanSubmit();
    await waitFor(() => expect(mocks.updateMember).toHaveBeenCalled());
    const payload = mocks.updateMember.mock.calls[0][1] as Partial<FamilyMember>;
    expect(payload.marga).toBeUndefined();
  });
});

describe('marga UI: MemberDetailSidebar', () => {
  it('8. marga terisi: nilai marga tampil di sidebar', () => {
    mocks.selectedMember = anggota({ marga: 'Simanjuntak' });
    render(<MemberDetailSidebar />);
    expect(screen.getByText('Simanjuntak')).toBeTruthy();
  });

  it('9. marga nihil: baris marga tidak dirender', () => {
    mocks.selectedMember = anggota({});
    render(<MemberDetailSidebar />);
    expect(screen.queryByText('Simanjuntak')).toBeNull();
  });
});
