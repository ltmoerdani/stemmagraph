/**
 * Filter RESN untuk ekspor GEDCOM (STG v134-a).
 *
 * Modul pure: tanpa import DB, prisma, atau fs. Delegasi normalisasi dan
 * precedence ke event-resn.ts.
 *
 * Aturan spec Removing Data: nilai CONFIDENTIAL dibuang sepenuhnya sehingga
 * rantai hapus terjaga dan data tersebut tidak pernah masuk hasil ekspor.
 * PRIVACY dan LOCKED lolos fase ini untuk menjaga round-trip fidelity.
 */
import {
  effectiveResn,
  normalizeResnLine,
} from './event-resn'

const BLOCKED_FOR_EXPORT: readonly string[] = ['CONFIDENTIAL']

/**
 * Filter daftar nilai RESN untuk ekspor.
 *
 * - null/undefined/array kosong menghasilkan array kosong.
 * - Tiap nilai dinormalisasi via normalizeResnLine lalu di-flatten.
 * - CONFIDENTIAL dibuang sepenuhnya.
 * - Item kosong hasil normalisasi dibuang.
 * - Dedup mempertahankan urutan kemunculan pertama, sehingga idempoten:
 *   filterResnForExport(filterResnForExport(x)) === filterResnForExport(x).
 */
export function filterResnForExport(
  input: string[] | null | undefined,
): string[] {
  if (input == null || input.length === 0) return []

  const result: string[] = []
  for (const raw of input) {
    for (const level of normalizeResnLine(raw)) {
      if (BLOCKED_FOR_EXPORT.includes(level)) continue
      if (!result.includes(level)) result.push(level)
    }
  }
  return result
}

/**
 * Gabungkan RESN event dan RESN record untuk ekspor.
 *
 * Delegasi precedence ke effectiveResn: RESN event mengungguli RESN record.
 * Hasilnya lalu lolos filterResnForExport. Input null menghasilkan array kosong.
 */
export function resolveExportResn(input: {
  resn?: string | null
  resnMulti?: string[] | null
} | null): string[] {
  if (input == null) return []
  const merged = effectiveResn(
    { resn: input.resn ?? null },
    { resn: input.resnMulti ?? null },
  )
  return filterResnForExport(merged)
}
