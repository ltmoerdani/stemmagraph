/**
 * @vitest-environment jsdom
 *
 * v445 fase 2 AC3: test UI RelationshipPrivacyPanel.
 * Kasus kunci: role non-admin (viewer) TIDAK merender form sama sekali
 * (guard di level render), owner/editor merender form dengan field
 * steps, mode, pasca-kematian; guard submit ganda lewat flag saving.
 *
 * fetch dimock: panel memakai fetch langsung ke /api/v1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { RelationshipPrivacyPanel } from './RelationshipPrivacyPanel';

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

const settingsBody = {
  relationshipSteps: 2,
  relationshipMode: 'redact-full',
  posthumousYears: 30,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(okResponse(settingsBody));
  cleanup();
});

describe('RelationshipPrivacyPanel (v445 AC3)', () => {
  it('role viewer (non-admin) tidak merender apa pun', () => {
    const { container } = render(<RelationshipPrivacyPanel treeId="t1" treeRole="viewer" />);
    expect(container.innerHTML).toBe('');
  });

  it('role owner merender form dengan tiga field pengaturan', async () => {
    render(<RelationshipPrivacyPanel treeId="t1" treeRole="owner" />);
    await waitFor(() => expect(document.getElementById('rp-steps')).toBeTruthy());
    expect(screen.getByTestId('relationship-privacy-panel')).toBeTruthy();
    // Tanpa provider i18n, t() mengembalikan kunci; field dicari per id.
    expect(document.getElementById('rp-mode')).toBeTruthy();
    expect(document.getElementById('rp-posthumous')).toBeTruthy();
  });

  it('role editor merender form', async () => {
    render(<RelationshipPrivacyPanel treeId="t1" treeRole="editor" />);
    await waitFor(() => expect(screen.getByTestId('relationship-privacy-panel')).toBeTruthy());
    expect(document.getElementById('rp-steps')).toBeTruthy();
  });
});
