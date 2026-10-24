/**
 * Saklar sumber baca stats by-century (v384, GAP 0.6 fase cutover
 * ADR 0011): env STATS_READ_SOURCE memilih jalur agregasi empat route
 * by-century di server. Default entity (jalur v383, compute*FromEvents);
 * nilai legacy menjalankan compute legacy existing atas rekaman yang
 * dipetakan dari baris LifeEvent, menjadi jalur fallback rollback
 * instan tanpa redeploy (restart dengan env beda cukup). Nilai tidak
 * dikenal selalu jatuh ke default agar salah ketik env tidak pernah
 * mematikan route. Murni: tanpa I/O, tanpa jam sistem.
 */

export type StatsReadSource = 'entity' | 'legacy'

/** Nama env yang dibaca server per request (bukan di module load). */
export const STATS_READ_SOURCE_ENV = 'STATS_READ_SOURCE'

/** Default dan satu-satunya jalur yang dianggap sah selain legacy. */
export const DEFAULT_STATS_READ_SOURCE: StatsReadSource = 'entity'

/**
 * Resolve nilai env menjadi jalur baca. Hanya string persis 'legacy'
 * yang memilih legacy; undefined, kosong, dan nilai apa pun lainnya
 * menghasilkan default entity.
 */
export function resolveReadSource(raw: string | undefined): StatsReadSource {
  if (raw === 'legacy') return 'legacy'
  return DEFAULT_STATS_READ_SOURCE
}
