/**
 * @vitest-environment jsdom
 *
 * S-07 regrant: klik tombol Regrant di seksi Consent MemberEditModal
 * mengirim action 'regrant' melalui adapter ConsentApi. Tombol hanya
 * tampil saat state terakhir revoked (selaras reducer applyRecord).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import type { ConsentStateView } from '../../../lib/adapters';

const mockPostConsent = vi.fn();
const mockGetConsent = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../lib/adapters', () => ({
  getConsentApi: () => ({ getConsent: mockGetConsent, postConsent: mockPostConsent }),
}));

const { MemberEditModal } = await import('./MemberEditModal');

const member: FamilyMember = {
  id: 'm1',
  name: 'Test Member',
  birthDate: '1990-01-01',
  gender: 'male',
  isAlive: true,
  generation: 2,
  maritalStatus: 'single',
};

const revokedState: ConsentStateView = {
  granted: false,
  records: [
    { id: 'rec_1', memberId: 'm1', action: 'grant', scope: 'export photos', note: null, at: '2026-09-16T02:00:00.000Z' },
    { id: 'rec_2', memberId: 'm1', action: 'revoke', scope: 'export photos', note: null, at: '2026-09-16T03:00:00.000Z' },
  ],
};

beforeEach(() => {
  cleanup();
  mockPostConsent.mockReset();
  mockGetConsent.mockReset();
  mockGetConsent.mockResolvedValue(revokedState);
});

describe('MemberEditModal consent Regrant', () => {
  it('klik Regrant mengirim action regrant via adapter ConsentApi', async () => {
    mockPostConsent.mockResolvedValue({
      record: { id: 'rec_3', memberId: 'm1', action: 'regrant', scope: 'export photos', note: null, at: '2026-09-16T04:00:00.000Z' },
      granted: true,
      privacyStatus: 'shared',
    });

    const { container, getByRole } = render(
      <MemberEditModal member={member} isOpen onClose={() => {}} onSave={() => {}} />,
    );

    // Tombol tampil karena state terakhir revoked.
    const regrantButton = await waitFor(() => getByRole('button', { name: 'consent.regrantAction' }));

    // Scope wajib diisi sebelum action (aturan yang sama dengan Grant/Revoke).
    const scopeInput = container.querySelector('#member-consent-scope') as HTMLInputElement;
    fireEvent.change(scopeInput, { target: { value: 'export photos' } });
    fireEvent.click(regrantButton);

    await waitFor(() => {
      expect(mockPostConsent).toHaveBeenCalledTimes(1);
    });
    expect(mockPostConsent).toHaveBeenCalledWith('m1', 'regrant', 'export photos', undefined);
  });
});
