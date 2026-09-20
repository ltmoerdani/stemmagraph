// Delegasi RESN import ke fungsi pure di privacy/resn (v128-ii-a).
import { resnToPrivacyStatus } from '../privacy/resn'

export function privacyStatusFromResn(resn: string | null | undefined): 'private' | null {
  return resnToPrivacyStatus(resn)
}

/**
 * Adapter RESN multi-nilai untuk import GEDCOM (v130-i).
 *
 * Jembatan pure antara payload RESN mentah hasil parse baris GEDCOM
 * (v128-ii-d membawa nilai verbatim, contoh 'CONFIDENTIAL, LOCKED')
 * dan privacyStatus internal Stemmagraph.
 *
 * Fase ini HANYA menyediakan fungsi pure. Pemanggilan nyata pada
 * importIndividuals.ts adalah ruang lingkup fase ii; di sini tidak ada
 * wiring, tidak ada I/O.
 */

import { parseResnList, resnListToPrivacyStatus } from '../privacy/resn-list'

/**
 * Petakan nilai RESN mentah (satuan maupun multi-nilai) ke
 * privacyStatus.
 *
 * - 'CONFIDENTIAL, LOCKED' dan 'CONFIDENTIAL,LOCKED' sama-sama
 *   mengembalikan 'private' (bentuk multi-nilai resmi testfile
 *   maximal70.ged kini termap, tidak lagi jatuh ke default null).
 * - Satu nilai valid ('CONFIDENTIAL'/'PRIVACY'/'LOCKED', toleran
 *   case) mengembalikan 'private', konsisten resnToPrivacyStatus v128.
 * - Item tak dikenal diabaikan; bila seluruh item tak dikenal,
 *   null/undefined/empty, hasilnya null: tidak ada RESN tercatat.
 */
export function applyResnToPrivacyStatus(
  raw: string | null | undefined,
): 'shared' | 'private' | null {
  return resnListToPrivacyStatus(parseResnList(raw))
}
