/**
 * @vitest-environment jsdom
 *
 * Test wiring v398 AC6: MemberPhotoControls (jsdom).
 *
 * Mock adapter surface via mock getMemberPhotoApi dan mock modul
 * photoClient.preparePhotoForUpload (canvas nyata tidak ada di jsdom).
 * Cakupan: pilih file => preview + dua tombol; apply => upload terpanggil
 * + onUpdated(photoUrl); cancel membersihkan; remove => delete terpanggil;
 * error client dirender per kode; adapter null => nihil dirender.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const uploadMemberPhoto = vi.hoisted(() => vi.fn());
const deleteMemberPhoto = vi.hoisted(() => vi.fn());
const getMemberPhotoApi = vi.hoisted(() => vi.fn());
const preparePhotoForUpload = vi.hoisted(() => vi.fn());

vi.mock('../../lib/adapters', () => ({ getMemberPhotoApi }));
vi.mock('../../lib/photo/photoClient', () => ({
  preparePhotoForUpload,
  PHOTO_CLIENT_MAX_BYTES: 10 * 1024 * 1024,
  PHOTO_MIN_DIMENSION: 16,
}));

import { MemberPhotoControls } from './MemberPhotoControls';

function mockAdapterAda(): void {
  getMemberPhotoApi.mockReturnValue({ uploadMemberPhoto, deleteMemberPhoto });
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  preparePhotoForUpload.mockResolvedValue({
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    mime: 'image/jpeg',
  });
});

function beriFile(): void {
  const input = screen.getByTestId('member-photo-input') as HTMLInputElement;
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x01])], 'foto.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

async function bukaPreview(): Promise<void> {
  mockAdapterAda();
  render(<MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={() => undefined} />);
  beriFile();
  await screen.findByTestId('member-photo-preview');
}

describe('MemberPhotoControls', () => {
  it('adapter nihil: kontrol tidak dirender', () => {
    getMemberPhotoApi.mockReturnValue(null);
    render(<MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={() => undefined} />);
    expect(screen.queryByTestId('member-photo-pick')).toBeNull();
  });

  it('label ganti saat sudah ada foto, unggah saat belum', () => {
    mockAdapterAda();
    const { rerender } = render(
      <MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={() => undefined} />,
    );
    expect(screen.getByTestId('member-photo-pick').textContent).toBe('memberPhoto.upload');
    rerender(<MemberPhotoControls memberId="m-1" hasPhoto={true} onUpdated={() => undefined} />);
    expect(screen.getByTestId('member-photo-pick').textContent).toBe('memberPhoto.change');
  });

  it('dua langkah: pilih file menampilkan preview lalu apply memanggil upload dan onUpdated', async () => {
    mockAdapterAda();
    const onUpdated = vi.fn();
    uploadMemberPhoto.mockResolvedValue({
      ok: true,
      photoUrl: '/api/v1/members/m-1/photo?f=x.jpg',
      member: {},
    });
    render(<MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={onUpdated} />);
    beriFile();
    await screen.findByTestId('member-photo-preview');
    fireEvent.click(screen.getByTestId('member-photo-apply'));
    await waitFor(() =>
      expect(uploadMemberPhoto).toHaveBeenCalledWith('m-1', expect.any(Uint8Array), 'image/jpeg'),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith('/api/v1/members/m-1/photo?f=x.jpg'));
  });

  it('cancel membersihkan preview tanpa memanggil upload', async () => {
    await bukaPreview();
    fireEvent.click(screen.getByTestId('member-photo-cancel'));
    await waitFor(() => expect(screen.queryByTestId('member-photo-preview')).toBeNull());
    expect(uploadMemberPhoto).not.toHaveBeenCalled();
  });

  it('remove memanggil delete dan onUpdated(null)', async () => {
    mockAdapterAda();
    const onUpdated = vi.fn();
    render(<MemberPhotoControls memberId="m-1" hasPhoto={true} onUpdated={onUpdated} />);
    deleteMemberPhoto.mockResolvedValue({ ok: true, member: {} });
    fireEvent.click(screen.getByTestId('member-photo-remove'));
    await waitFor(() => expect(deleteMemberPhoto).toHaveBeenCalledWith('m-1'));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(null));
  });

  it('error client dirender per kode TOO_LARGE', async () => {
    mockAdapterAda();
    preparePhotoForUpload.mockRejectedValue(new Error('TOO_LARGE'));
    render(<MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={() => undefined} />);
    beriFile();
    await waitFor(() => expect(screen.getByTestId('member-photo-error')).toBeDefined());
  });

  it('error server 403 dirender pakai kode FORBIDDEN_TREE', async () => {
    mockAdapterAda();
    const onUpdated = vi.fn();
    const err = new Error('forbidden') as Error & { code: string };
    err.code = 'FORBIDDEN_TREE';
    uploadMemberPhoto.mockRejectedValue(err);
    render(<MemberPhotoControls memberId="m-1" hasPhoto={false} onUpdated={onUpdated} />);
    beriFile();
    await screen.findByTestId('member-photo-preview');
    fireEvent.click(screen.getByTestId('member-photo-apply'));
    await waitFor(() => expect(screen.getByTestId('member-photo-error')).toBeDefined());
  });
});
