import type { GenealogicalDate } from './genealogical-date'

/**
 * Tipe event genealogis inti, mengikuti kode GEDCOM 5.5.1/7:
 * BIRT (kelahiran), DEAT (kematian), MARR (pernikahan).
 */
export const EVENT_TYPES = ['BIRT', 'DEAT', 'MARR'] as const

export type EventType = (typeof EVENT_TYPES)[number]

/** Event genealogis tunggal: tanggal boleh absen (null), place verbatim. */
export interface GenealogicalEvent {
  type: EventType
  date: GenealogicalDate | null
  /**
   * Tempat kejadian apa adanya, TIDAK dipecah kota/provinsi/negara.
   * Keputusan fase 1: parsing place ditunda; simpan verbatim agar
   * round-trip tidak kehilangan data.
   */
  place: string | null
}

export function isEventType(value: unknown): value is EventType {
  return (
    typeof value === 'string' &&
    (EVENT_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Builder GenealogicalEvent dengan validasi type.
 *
 * Keputusan penanganan error: melempar Error bila type di luar EVENT_TYPES
 * (bukan mengembalikan union error). Alasannya: type salah berarti bug di
 * call site, bukan kondisi data yang wajar; gagal cepat lebih jelas daripada
 * memaksa setiap pemanggil menangani hasil error.
 *
 * @param type  kode event, harus salah satu dari EVENT_TYPES (case-sensitive)
 * @param date  tanggal hasil parseGenealogicalDate; null/undefined diizinkan
 * @param place teks tempat verbatim; null/undefined diizinkan
 */
export function makeEvent(
  type: string,
  date: GenealogicalDate | null = null,
  place: string | null = null,
): GenealogicalEvent {
  if (!isEventType(type)) {
    throw new Error(
      `Tipe event tidak dikenal: "${type}". Gunakan salah satu dari: ${EVENT_TYPES.join(', ')}`,
    )
  }
  return { type, date, place }
}
