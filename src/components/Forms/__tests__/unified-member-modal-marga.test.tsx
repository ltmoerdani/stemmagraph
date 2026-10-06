/**
 * @vitest-environment jsdom
 *
 * Test wiring saran marga v250-ii: baris saran ADD-ONLY di bawah input marga
 * UnifiedMemberModal. suggestMargaValues di-mock agar skenario bank terkendali;
 * store dan adapter di-mock mengikuti pola marga-ui.test.tsx. Asersi
 * fungsional: render saran, klik mengisi formData.marga, bank nihil, label
 * i18n, nilai terakhir menang, typing manual tetap jalan.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';
import { UnifiedMemberModal } from '../UnifiedMemberModal';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  suggestMargaValues: vi.fn<[], string[]>(),
  addMember: vi.fn(),
  updateMember: vi.fn(),
  addMemberWithRelationship: vi.fn(),
  createChangeProposal: vi.fn(),
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

vi.mock('../../../lib/adapters', () => ({
  getChangeReviewApi: () => ({ createChangeProposal: mocks.createChangeProposal }),
}));

function inputMarga() {
  return screen.getByLabelText(idCommon.form.margaLabel) as HTMLInputElement;
}

beforeEach(() => {
  mocks.language = 'id';
  mocks.addMember.mockResolvedValue('m-baru');
  mocks.updateMember.mockResolvedValue(undefined);
  mocks.addMemberWithRelationship.mockResolvedValue('m-baru');
  mocks.createChangeProposal.mockResolvedValue({ id: 'p1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('wiring saran marga v250-ii: UnifiedMemberModal', () => {
  it('1. saran dari suggestMargaValues dirender sebagai tombol di bawah input marga', () => {
    mocks.suggestMargaValues.mockReturnValue(['Simanjuntak', 'Sitompul']);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText(idCommon.form.margaSuggestLabel)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gunakan saran marga Simanjuntak' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gunakan saran marga Sitompul' })).toBeTruthy();
  });

  it('2. klik saran mengisi input marga', () => {
    mocks.suggestMargaValues.mockReturnValue(['Simanjuntak', 'Sitompul']);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(inputMarga().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan saran marga Simanjuntak' }));
    expect(inputMarga().value).toBe('Simanjuntak');
  });

  it('3. bank nihil: baris saran tidak dirender, helper marga tetap tampil', () => {
    mocks.suggestMargaValues.mockReturnValue([]);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByText(idCommon.form.margaSuggestLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: /Gunakan saran marga/ })).toBeNull();
    expect(screen.getByText(idCommon.form.margaHelper)).toBeTruthy();
    expect(mocks.suggestMargaValues).toHaveBeenCalledTimes(1);
  });

  it('4. label i18n en dirender saat locale en', () => {
    mocks.language = 'en';
    mocks.suggestMargaValues.mockReturnValue(['Simanjuntak']);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText(enCommon.form.margaSuggestLabel)).toBeTruthy();
    expect(enCommon.form.margaSuggestLabel).toBe('Suggestions:');
    expect(enCommon.form.margaSuggestAria).toBe('Use marga suggestion');
    expect(
      screen.getByRole('button', { name: `${enCommon.form.margaSuggestAria} Simanjuntak` }),
    ).toBeTruthy();
  });

  it('5. klik dua saran berbeda: nilai terakhir menang', () => {
    mocks.suggestMargaValues.mockReturnValue(['Simanjuntak', 'Sitompul']);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan saran marga Simanjuntak' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan saran marga Sitompul' }));
    expect(inputMarga().value).toBe('Sitompul');
  });

  it('6. typing manual tetap jalan setelah saran dirender', () => {
    mocks.suggestMargaValues.mockReturnValue(['Simanjuntak', 'Sitompul']);
    render(<UnifiedMemberModal isOpen onClose={vi.fn()} />);
    fireEvent.change(inputMarga(), { target: { value: 'Sihombing' } });
    expect(inputMarga().value).toBe('Sihombing');
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan saran marga Sitompul' }));
    expect(inputMarga().value).toBe('Sitompul');
    fireEvent.change(inputMarga(), { target: { value: 'Sihombing' } });
    expect(inputMarga().value).toBe('Sihombing');
  });
});
