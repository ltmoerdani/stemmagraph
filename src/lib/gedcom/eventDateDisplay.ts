// Display i18n tanggal event genealogi (v271 fase i, add-only).
//
// Sumber acuan spesifikasi tanggal GEDCOM 7:
//   https://gedcom.io/
//   https://gedcom.io/specifications/
//
// Kualifier presisi longgar ABT/BEF/AFT terverifikasi hidup di repo ini:
// parser src/lib/gedcom/parseEventDate.ts menerima ABT/ABOUT/BEF/BEFORE/
// AFT/AFTER dan memetakannya ke dateKind ABOUT/BEFORE/AFTER, sedangkan
// formatter src/lib/gedcom/formatGedcomDate.ts memetakannya kembali ke
// payload berprefix ABT/BEF/AFT. Modul ini hanya menerjemahkan hasil
// parser itu menjadi teks tampilan, tanpa menyentuh kedua berkas itu.
//
// Pemetaan prefix per locale (fase i):
//   ABOUT  : id "sekitar X" | en "about X"
//   BEFORE : id "sebelum X" | en "before X"
//   AFTER  : id "sesudah X" | en "after X"
//   EXACT  : tanpa prefix, pola konsisten formatGedcomDate existing
//            (hari, bulan tiga huruf, tahun; presisi dijaga).
//
// RANGE di luar scope fase i: dateKind RANGE kembali null. Kontrak
// string | null: null berarti pemanggil menangani fallback tampilannya
// sendiri (pola null yang sama dipakai formatGedcomDate.ts).
// i18n nama bulan di luar scope fase i; nama bulan tetap tiga huruf
// GEDCOM seperti formatter existing.
//
// Locale tak dikenal pada runtime fallback ke 'en'.
//
// Murni fungsi: satu-satunya import adalah tipe dari parseEventDate,
// tanpa I/O, tanpa jam sistem, tanpa state.

import type { ParsedEventDate } from './parseEventDate'

/** Prefix kualifier ABOUT per locale, huruf kecil sesuai kontrak v271. */
const PREFIX_ABOUT: Record<'id' | 'en', string> = {
  id: 'sekitar',
  en: 'about',
}

/** Prefix kualifier BEFORE per locale. */
const PREFIX_BEFORE: Record<'id' | 'en', string> = {
  id: 'sebelum',
  en: 'before',
}

/** Prefix kualifier AFTER per locale. */
const PREFIX_AFTER: Record<'id' | 'en', string> = {
  id: 'sesudah',
  en: 'after',
}

/**
 * Nama bulan tiga huruf GEDCOM 7, konsisten dengan MONTH_NAMES di
 * formatGedcomDate.ts existing; indeks 0 kosong karena bulan mulai 1.
 */
const MONTH_NAMES: readonly string[] = [
  '', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

/**
 * Validasi defensif komponen tanggal, selaras isValidComponents di
 * formatGedcomDate.ts: parser sudah menjamin rentang ini, formatter
 * display tetap menolak komponen mustahil agar tidak pernah menghasilkan
 * teks tampilan yang salah bentuk.
 */
function formatExactParts(year: number, month?: number, day?: number): string | null {
  if (!Number.isInteger(year) || year < 1) return null
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) return null
  if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) return null
  if (day !== undefined && month !== undefined) return `${day} ${MONTH_NAMES[month]} ${year}`
  if (month !== undefined) return `${MONTH_NAMES[month]} ${year}`
  return String(year)
}

/**
 * Format hasil parseEventDate menjadi teks tampilan untuk locale 'id'
 * atau 'en'. Tidak pernah melempar: input tidak sah, dateKind tak
 * dikenal, komponen tidak sah, ABOUT tanpa komponen (hasil gagal urai
 * parser), maupun RANGE kembali null dan pemanggil menangani fallback.
 */
export function displayEventDate(parsed: ParsedEventDate, locale: 'id' | 'en'): string | null {
  if (parsed === null || typeof parsed !== 'object') return null
  const loc: 'id' | 'en' = locale === 'id' ? 'id' : 'en'

  switch (parsed.dateKind) {
    case 'EXACT':
      return formatExactParts(parsed.year, parsed.month, parsed.day)

    case 'ABOUT': {
      if (parsed.year === undefined) return null
      const value = formatExactParts(parsed.year, parsed.month, parsed.day)
      return value === null ? null : `${PREFIX_ABOUT[loc]} ${value}`
    }

    case 'BEFORE': {
      const value = formatExactParts(parsed.year, parsed.month, parsed.day)
      return value === null ? null : `${PREFIX_BEFORE[loc]} ${value}`
    }

    case 'AFTER': {
      const value = formatExactParts(parsed.year, parsed.month, parsed.day)
      return value === null ? null : `${PREFIX_AFTER[loc]} ${value}`
    }

    case 'RANGE':
      // Di luar scope fase i (catatan header): null ditangani pemanggil.
      return null

    default:
      return null
  }
}
