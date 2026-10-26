/**
 * Modul pure consent self-service (v408, VISION gap 3).
 * Subjek data (anggota keluarga) mengelola consent dirinya: keputusan
 * akses di sini, transaksi ledger tetap satu pintu di server.
 *
 * Fondasi feasibility PM 26 Okt 2026 (wake-169):
 * - POST /api/v1/members/:memberId/consent (owner-only, guard
 *   manage_invitations) adalah satu-satunya jalur tulis ledger; sisa
 *   gap 3 minta dan tarik persetujuan oleh subjek data belum ada.
 * - Identitas anggota-user terverifikasi pola resolveViewerRelation
 *   (src/lib/privacy/viewer-relation.ts): FamilyMember.email vs
 *   User.email, normalisasi trim lowercase.
 * - Reducer append-only src/lib/consent/record.ts (grant, revoke,
 *   regrant) dipakai ulang apa adanya, tidak diubah.
 *
 * Kontrak v408: TIDAK ada perubahan schema, reducer, route owner
 * existing, lockfile. Modul pure: tanpa I/O, tanpa dependency.
 */

export type SelfConsentDenyReason = 'EMAIL_MISSING' | 'NOT_SELF';

export interface SelfConsentInput {
  /** Email User pemanggil (viewer). null/undefined berarti tidak tercatat. */
  viewerEmail?: string | null;
  /** Email FamilyMember target. null/undefined berarti tidak tercatat. */
  memberEmail?: string | null;
  /** Id FamilyMember target. */
  memberId: string;
  /** Id member dari path URL, wajib identik. */
  targetMemberId: string;
}

export type SelfConsentAccess = { ok: true } | { ok: false; reason: SelfConsentDenyReason };

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Keputusan akses self-service: pemanggil boleh mencatat consent
 * pada member hanya bila email User dan email member cocok (setelah
 * normalisasi) DAN id member path identik dengan target.
 *
 * Keputusan konservatif konsisten viewer-relation.ts: email kosong
 * atau tidak cocok ditolak. 403 tidak membocorkan ada-tidaknya member
 * (anti-enumerasi pola v261-i): alasan lengkap hanya di log server.
 */
export function resolveSelfConsentAccess(input: SelfConsentInput): SelfConsentAccess {
  const viewer = normalizeEmail(input.viewerEmail);
  const member = normalizeEmail(input.memberEmail);
  if (viewer.length === 0 || member.length === 0) {
    return { ok: false, reason: 'EMAIL_MISSING' };
  }
  if (input.memberId !== input.targetMemberId) {
    return { ok: false, reason: 'NOT_SELF' };
  }
  if (viewer !== member) {
 return { ok: false, reason: 'NOT_SELF' };
  }
  return { ok: true };
}
