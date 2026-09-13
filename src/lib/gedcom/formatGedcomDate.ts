// Formatter murni: ParsedEventDate -> payload DateValue GEDCOM 7 (S1F4-A).
//
// Prinsip "persisi tersimpan tidak pernah lebih tegas daripada sumber"
// (ADR 0011 keputusan 1): presisi hasil parseEventDate dipertahankan
// persis seperti sumbernya. Tahun saja tetap tahun saja, bulan+tahun
// tetap tanpa hari, dan rentang BET..AND menjaga presisi masing-masing
// sisi. Formatter tidak pernah menambah komponen yang tidak ada pada
// hasil parser dan tidak pernah mengarang presisi dari teks yang tidak
// dikenali.
//
// Pemetaan (payload sah untuk tag DATE pada export GEDCOM 7):
//   EXACT  : "12 MAR 1945" | "MAR 1945" | "1945" (sesuai komponen ada)
//   ABOUT  : "ABT " + nilai exact setara
//   BEFORE : "BEF " + nilai exact setara
//   AFTER  : "AFT " + nilai exact setara
//   RANGE  : "BET <from> AND <to>" (presisi tiap sisi dijaga)
//
// Hasil parser yang tidak mewakili tanggal sah (ABOUT tanpa komponen,
// hasil gagal urai parseEventDate) kembali null sehingga pemanggil
// bisa memakai fallback string mentah.
//
// Murni fungsi: satu-satunya import adalah tipe dari parseEventDate,
// tanpa I/O, tanpa process.env, tanpa state.

import type {
  EventDateComponents,
  ParsedEventDate,
} from './parseEventDate'

/**
 * Nama bulan singkat DateExact GEDCOM 7 (tiga huruf kapital Inggris),
 * diindeks 1..12; indeks 0 sengaja kosong karena bulan mulai dari 1.
 */
const MONTH_NAMES: readonly string[] = [
  '', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

/**
 * Validasi defensif komponen tanggal. Parser sudah menjamin rentang ini,
 * tetapi formatter tetap menolak komponen mustahil agar tidak pernah
 * menghasilkan payload GEDCOM yang salah bentuk (mis. bulan 13).
 */
function isValidComponents(c: EventDateComponents): boolean {
  if (!Number.isInteger(c.year) || c.year < 1) return false
  if (c.month !== undefined && (c.month < 1 || c.month > 12)) return false
  if (c.day !== undefined && (c.day < 1 || c.day > 31)) return false
  return true
}

/**
 * Format satu komponen tanggal mengikuti presisi yang tersedia:
 * hari+bulan+tahun, bulan+tahun, atau tahun saja. Komponen yang tidak
 * sah kembali null.
 */
function formatComponents(c: EventDateComponents): string | null {
  if (!isValidComponents(c)) return null
  if (c.day !== undefined && c.month !== undefined) {
    return `${c.day} ${MONTH_NAMES[c.month]} ${c.year}`
  }
  if (c.month !== undefined) {
    return `${MONTH_NAMES[c.month]} ${c.year}`
  }
  return String(c.year)
}

/**
 * Memetakan hasil parseEventDate ke payload DateValue GEDCOM 7.
 * Tidak pernah melempar: input null, dateKind tak dikenal, atau
 * komponen tidak sah kembali null.
 */
export function formatGedcomDateValue(parsed: ParsedEventDate): string | null {
  if (parsed === null || typeof parsed !== 'object') return null

  switch (parsed.dateKind) {
    case 'EXACT':
      return formatComponents({ year: parsed.year, month: parsed.month, day: parsed.day })

    case 'ABOUT': {
      if (parsed.year === undefined) return null
      const value = formatComponents({ year: parsed.year, month: parsed.month, day: parsed.day })
      return value === null ? null : `ABT ${value}`
    }

    case 'BEFORE': {
      const value = formatComponents({ year: parsed.year, month: parsed.month, day: parsed.day })
      return value === null ? null : `BEF ${value}`
    }

    case 'AFTER': {
      const value = formatComponents({ year: parsed.year, month: parsed.month, day: parsed.day })
      return value === null ? null : `AFT ${value}`
    }

    case 'RANGE': {
      const from = formatComponents(parsed.from)
      const to = formatComponents(parsed.to)
      if (from === null || to === null) return null
      return `BET ${from} AND ${to}`
    }

    default:
      return null
  }
}
