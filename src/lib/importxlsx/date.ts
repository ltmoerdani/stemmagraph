/**
 * v397 XLSX Import Fase 1: konversi serial tanggal Excel 1900 ke ISO (YYYY-MM-DD).
 *
 * Sistem tanggal 1900 Excel memuat satu hari fiktif: serial 60 =
 * 1900-02-29, hari kabisat yang tidak ada di kalender Gregorian
 * (kompatibilitas Lotus 1-2-3). Kontrak fase 1 (AC2):
 * - serial 1 sampai 59 dihitung dari anchor 1899-12-31 (serial 1 =
 *   1900-01-01, serial 59 = 1900-02-28);
 * - serial 60 ditolak, barisnya menjadi invalid lewat pipeline v386;
 * - serial 61 ke atas dihitung dari anchor 1899-12-30 (serial 61 =
 *   1900-03-01), sehingga hari fiktif terlewati tanpa diam-diam
 *   digeser ke tanggal lain.
 * Reuse isValidIsoDate dari importcsv sebagai validasi akhir agar
 * kontrak tanggal identik dengan import CSV v386.
 */
import { isValidIsoDate } from '../importcsv/validateCsv';

/** Milliseconds in one day, used to walk from an anchor date. */
const MS_PER_DAY = 86_400_000;

/** Anchor for serials 1..59: serial 1 lands on 1900-01-01. */
const ANCHOR_LOW_MS = Date.UTC(1899, 11, 31);

/** Anchor for serials 61 and above: serial 61 lands on 1900-03-01. */
const ANCHOR_HIGH_MS = Date.UTC(1899, 11, 30);

/**
 * Converts an Excel 1900 date-system serial number to YYYY-MM-DD.
 *
 * Returns null when the serial cannot represent a real calendar date:
 * non-finite input, non-positive values, fractional-only concerns are
 * ignored via floor (time-of-day fractions carry no date meaning for
 * the 10-column template), and serial 60 (the fictitious 1900-02-29).
 * The result must pass isValidIsoDate (reused from the v386 CSV
 * pipeline) or null is returned, so callers mark the row invalid with
 * an honest reason instead of writing a shifted date silently.
 */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const whole = Math.floor(serial);
  if (whole === 60) return null; // fictitious 1900-02-29
  const anchorMs = whole <= 59 ? ANCHOR_LOW_MS : ANCHOR_HIGH_MS;
  const date = new Date(anchorMs + whole * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  return isValidIsoDate(iso) ? iso : null;
}
