import type { CalendarSystem } from './calendar-system'

/**
 * Entitas GenealogicalEvent bentuk v419 fase 2 (AC1).
 *
 * Catatan pemisahan modul: nama GenealogicalEvent dan makeEvent sudah
 * terpakai di src/lib/genealogy/event-model.ts dengan bentuk lama
 * (signature positional, date CalendarDate terstruktur) dan masih dipakai
 * schema-wiring.ts serta kinship.ts. Modul ini berdiri sendiri agar
 * pemakaian existing tidak berubah.
 *
 * AC2 fallback: union CalendarSystem sudah terdefinisi di calendar-system.ts
 * (GREGORIAN, JULIAN, FRENCH_R, HEBREW, DUAL). FRENCH_R adalah kalender
 * Prancis Revolusioner, jadi cakupan minimum AC2 terpenuhi. Definisi tidak
 * diduplikasi, cukup di-re-export.
 */
export type { CalendarSystem } from './calendar-system'

/** Kode jenis event GEDCOM yang didukung entitas v419. */
export const EVENT_KINDS = ['BIRT', 'DEAT', 'MARR'] as const

export type EventKind = (typeof EVENT_KINDS)[number]

/** Entitas event genealogis: id wajib, date verbatim, calendarSystem wajib. */
export interface GenealogicalEvent {
  /** Identitas unik event, wajib. */
  id: string
  /** Jenis event: BIRT (kelahiran), DEAT (kematian), MARR (pernikahan). */
  kind: EventKind
  /** Tanggal apa adanya sesuai sumber, tidak dinormalisasi. */
  date: string
  /** Tempat kejadian verbatim, tidak dipecah kota/provinsi/negara. */
  place?: string
  /** Sistem kalender tanggal ini. */
  calendarSystem: CalendarSystem
  /** Tanggal ganda format genealogi (mis. Julian vs Gregorian), optional. */
  dualDate?: string
}

export function isEventKind(value: unknown): value is EventKind {
  return (
    typeof value === 'string' &&
    (EVENT_KINDS as readonly string[]).includes(value)
  )
}
