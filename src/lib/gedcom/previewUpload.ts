/**
 * v417 fase 1: validasi unggahan GEDCOM preview dalam satu pintu.
 *
 * Parser multipart mini di src/lib/photo/multipart.ts tidak menyimpan
 * filename (hanya nama field), sedangkan preview GEDCOM mewajibkan
 * ekstensi .ged/.gdz dari nama berkas klien. Modul ini membungkus
 * parseMultipart lalu mengekstrak filename dari header part pertama
 * pada raw body (segmen sebelum CRLF CRLF, jadi isi file tidak mungkin
 * ikut terpola).
 *
 * Modul PURE: tanpa DB, tanpa server, tanpa filesystem, tidak melempar.
 */
import { parseMultipart } from '../photo/multipart';

export type GedcomUploadRejectReason = 'NO_FILE' | 'NO_FILENAME' | 'BAD_EXTENSION';

export type GedcomUploadParseResult =
  | { ok: true; fileName: string; bytes: Uint8Array }
  | { ok: false; reason: GedcomUploadRejectReason };

/** Ekstensi berkas yang sah untuk preview GEDCOM (AC1 v417). */
const GEDCOM_PREVIEW_EXT_RE = /\.(ged|gdz)$/i;

export function parseGedcomUpload(
  raw: Uint8Array,
  contentType: string | undefined,
): GedcomUploadParseResult {
  const parsed = parseMultipart(raw, contentType);
  const file = parsed?.file ?? null;
  if (file === null || file.bytes.length === 0) {
    return { ok: false, reason: 'NO_FILE' };
  }

  // Filename hanya dicari di header part pertama (sebelum pemisah
  // header-body pertama), supaya isi berkas tidak bisa memalsukan
  // hasil pencarian.
  const sep = raw.length >= 4 ? indexOfHeaderSep(raw) : -1;
  const headerArea = sep > 0 ? new TextDecoder('latin1').decode(raw.subarray(0, sep)) : '';
  const m = /filename="([^"]*)"/i.exec(headerArea);
  if (m === null || m[1] === '') {
    return { ok: false, reason: 'NO_FILENAME' };
  }
  const fileName = m[1];
  if (!GEDCOM_PREVIEW_EXT_RE.test(fileName)) {
    return { ok: false, reason: 'BAD_EXTENSION' };
  }
  return { ok: true, fileName, bytes: file.bytes };
}

function indexOfHeaderSep(raw: Uint8Array): number {
  for (let i = 0; i + 4 <= raw.length; i++) {
    if (
      raw[i] === 0x0d && raw[i + 1] === 0x0a &&
      raw[i + 2] === 0x0d && raw[i + 3] === 0x0a
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Pemeriksaan ringan dokumen GEDCOM: dokumen sah minimal punya record
 * HEAD di level 0 (spec GEDCOM 7 bab 2.6). Dipakai untuk menolak file
 * acak yang bukan GEDCOM sebelum pipeline dijalankan (400 stabil).
 */
export function looksLikeGedcom(text: string): boolean {
  return /(?:^|\n)\s*0\s+HEAD\b/.test(text);
}
