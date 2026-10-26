import { describe, expect, it } from 'vitest';
import { resolveSelfConsentAccess } from './self-consent';

describe('resolveSelfConsentAccess (v408)', () => {
  const base = {
    viewerEmail: ' anggota@keluarga.id ',
    memberEmail: 'Anggota@Keluarga.id',
    memberId: 'm-123',
    targetMemberId: 'm-123',
  };

  it('lulus bila email cocok setelah trim lowercase dan id identik', () => {
    expect(resolveSelfConsentAccess(base)).toEqual({ ok: true });
  });

  it('lulus bila kedua email sudah bersih dan identik', () => {
    expect(
      resolveSelfConsentAccess({ ...base, viewerEmail: 'a@b.id', memberEmail: 'a@b.id' }),
    ).toEqual({ ok: true });
  });

  it('menolak EMAIL_MISSING bila viewerEmail nihil', () => {
    expect(resolveSelfConsentAccess({ ...base, viewerEmail: null })).toEqual({
      ok: false,
      reason: 'EMAIL_MISSING',
    });
  });

  it('menolak EMAIL_MISSING bila memberEmail string kosong', () => {
    expect(resolveSelfConsentAccess({ ...base, memberEmail: '   ' })).toEqual({
      ok: false,
      reason: 'EMAIL_MISSING',
    });
  });

  it('menolak NOT_SELF bila email berbeda walau id identik', () => {
    expect(resolveSelfConsentAccess({ ...base, memberEmail: 'lain@keluarga.id' })).toEqual({
      ok: false,
      reason: 'NOT_SELF',
    });
  });

  it('menolak NOT_SELF bila id member path berbeda dari target', () => {
    expect(resolveSelfConsentAccess({ ...base, targetMemberId: 'm-lain' })).toEqual({
      ok: false,
      reason: 'NOT_SELF',
    });
  });
});
