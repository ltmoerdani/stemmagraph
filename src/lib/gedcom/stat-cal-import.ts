// Delegasi penuh ke modul merged parser-stat-cal: enum CHALLENGED DISPROVEN PROVEN plus raw utuh, 4 kalender resmi plus ekstensi, PHRASE utuh.
// FROM-TO dan BET-AND dipertahankan sebagai dua semantik berbeda; tanggal HEBREW dan ADR tidak dinormalisasi.
import { parseFamcStat, parseCalendarDate } from './parser-stat-cal';

export function famcStatPayload(raw: string) {
  return parseFamcStat(raw);
}

export function dateCalPayload(raw: string) {
  return parseCalendarDate(raw);
}
