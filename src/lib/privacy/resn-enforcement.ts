/**
 * Enforcement tiga level RESN GEDCOM 7 (GOAL v423 AC2).
 *
 * Modul PURE: tanpa I/O, tanpa DB, tanpa jam, tanpa dependensi selain
 * resolver komposit AC1 (resn.ts) dan parser daftar (resn-list.ts).
 * Pemanggil nyata hanya wiring server: path baca menyaring CONFIDENTIAL
 * (hidden), path mutasi menolak LOCKED (403), dan PRIVACY tidak menambah
 * logika apa pun di luar gerbang ekspor existing (exportPrivacyGate).
 *
 * Kontrak QA PM (adopsi evidence):
 *   - nilai RESN tak dikenal diperlakukan paling membatasi;
 *   - assert pakai toStrictEqual (bukan toEqual);
 *   - baseline snapshot pakai structuredClone;
 *   - guard no-mutasi pakai deepFreeze (Object.freeze shallow).
 */

import type { ResnLevel } from './resn.js'
import { parseResnList } from './resn-list.js'
import { resolveResnComposite } from './resn.js'

/**
 * Keputusan enforcement satu record:
 *   hidden: true berarti record tidak muncul di path baca normal;
 *   locked: true berarti edit/delete ditolak dengan error jelas.
 */
export interface ResnEnforcementDecision {
  hidden: boolean
  locked: boolean
}

/** Masukan enforcement: kolom verbatim DB satu record. */
export interface ResnEnforcementInput {
  /** Kolom verbatim DB; NULL/undefined/empty berarti tidak ada RESN. */
  resnVerbatim: string | null | undefined
}

/**
 * Guard no-mutasi dari kontrak QA PM: Object.freeze shallow untuk
 * membekukan hasil komposit sebelum dikembalikan, tanpa menyentuh
 * struktur milik pemanggil.
 */
function deepFreeze<T extends Record<string, unknown>>(value: T): T {
  Object.freeze(value)
  return value
}

/**
 * Keputusan enforcement satu record dari kolom verbatim.
 *
 * Verbatim absen (null/undefined/whitespace) bukan nilai tak dikenal:
 * menghasilkan hidden false locked false, perilaku baseline v422 tetap
 * utuh (semua member tanpa RESN tidak berubah). Token dikenal diurai
 * lewat parseResnList (toleran case) lalu komposit dihitung resolver
 * OR dua axis AC1 (resolveResnComposite): CONFIDENTIAL = hidden saja,
 * PRIVACY = tidak keduanya, LOCKED = hidden dan locked. Seluruh token
 * tak dikenal diperlakukan paling membatasi (kontrak QA PM): hidden
 * dan locked sekaligus, data malformed tidak pernah melebarkan akses.
 */
export function resolveResnEnforcement(
  input: ResnEnforcementInput,
): ResnEnforcementDecision {
  const raw = input.resnVerbatim
  if (raw == null || raw.trim() === '') {
    return deepFreeze({ hidden: false, locked: false })
  }
  const levels: ResnLevel[] = parseResnList(raw)
  if (levels.length === 0) {
    // Seluruh token tak dikenal: paling membatasi.
    return deepFreeze({ hidden: true, locked: true })
  }
  return resolveResnComposite(levels)
}

/**
 * Keputusan axis baca (AC2a): CONFIDENTIAL (dan LOCKED, karena LOCKED
 * meliputi axis hidden) menyembunyikan record dari path baca normal.
 */
export function isResnHidden(input: ResnEnforcementInput): boolean {
  return resolveResnEnforcement(input).hidden
}

/**
 * Keputusan axis mutasi (AC2b): LOCKED (dan verbatim tak dikenal)
 * menolak edit dan delete.
 */
export function isResnLocked(input: ResnEnforcementInput): boolean {
  return resolveResnEnforcement(input).locked
}
