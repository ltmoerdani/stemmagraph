/**
 * v445 fase 2: resolusi visibilitas yang membaca pengaturan keluarga.
 * Wrapper di atas resolveRelationshipVisibility fase 1 TANPA mengubah
 * modul fase 1 mana pun: relationship-privacy.ts, member-redaction.ts,
 * exportPrivacyGate.ts tetap seperti semula.
 *
 * Tambahan fase 2:
 * - posthumous: anggota meninggal lewat N tahun sejak deathDate terbaca
 *   penuh. Di bawah batas, aturan living-rule fase 1 berlaku (full hanya
 *   bila privacyStatus shared). deathDate kosong = living-rule.
 * - mode name-only pada jalur di luar batas jarak diputuskan pemanggil
 *   route (payload), wrapper hanya menyediakan keputusan per anggota.
 *
 * PURE: tanpa import eksternal selain modul privacy, tanpa efek samping.
 */

import {
  resolveRelationshipVisibility,
  type RelationshipVisibility,
  type ViewerRelation,
} from './relationship-privacy'
import { isPosthumouslyPublic, type FamilyPrivacySettingsValue } from './family-privacy-settings'

export interface VisibilityWithSettingsInput {
  viewerRelation: ViewerRelation
  privacyStatus?: 'shared' | 'private' | null
  /** Kolom isAlive di DB: false berarti ada catatan kematian. */
  isAlive: boolean
  /** YYYY-MM-DD atau null; kosong berarti living-rule. */
  deathDate?: string | null
}

/**
 * Keputusan visibilitas dengan pengaturan keluarga:
 * 1. self selalu full (aturan fase 1).
 * 2. Meninggal dan sudah lewat N tahun pasca-kematian => full.
 * 3. Meninggal di bawah batas (atau deathDate kosong) => living-rule
 *    fase 1 dievaluasi apa adanya (privacyStatus shared tetap full).
 * 4. Hidup => aturan fase 1 tanpa perubahan.
 */
export function resolveVisibilityWithSettings(
  input: VisibilityWithSettingsInput,
  settings: FamilyPrivacySettingsValue,
  now: Date,
): RelationshipVisibility {
  if (input.viewerRelation === 'self') return 'full'
  if (!input.isAlive) {
    if (isPosthumouslyPublic(input.deathDate, settings.posthumousYears, now)) return 'full'
    // Di bawah batas pasca-kematian: anggap living (privasi tetap terjaga
    // pada masa berkabung), kecuali consent shared eksplisit.
    if (input.privacyStatus === 'shared') return 'full'
    return input.viewerRelation === 'partner' ||
      input.viewerRelation === 'child' ||
      input.viewerRelation === 'parent'
      ? 'name-only'
      : 'hidden'
  }
  return resolveRelationshipVisibility({
    viewerRelation: input.viewerRelation,
    privacyStatus: input.privacyStatus,
    isAlive: input.isAlive,
  })
}
