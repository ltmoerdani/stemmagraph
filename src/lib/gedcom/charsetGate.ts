/**
 * Gate charset byte-level untuk import GEDCOM 7 (STG v464 unit 1a).
 *
 * Spec GEDCOM 7.0 menetapkan satu byte berkas identik dengan satu
 * karakter: 0x09, 0x0A, 0x0D, dan 0x20 sampai 0x7E. C0 di luar tiga
 * EOL itu, DEL 0x7F, dan C1 0x80-0x9F terlarang. U+FFFE dan U+FFFF
 * adalah noncharacter yang juga ditolak. Gate ini fail-closed: satu
 * pelanggaran saja membuat berkas ditolak lewat daftar error
 * terstruktur yang menyebut offset byte pelanggaran.
 *
 * BOM U+FEFF di awal berkas di-strip sebelum pemeriksaan karena
 * sifatnya opsional: penanda encoding, bukan data. Tag HEAD.CHAR
 * tidak dituntut karena tag CHAR dihapus di GEDCOM 7; berkas tanpa
 * BOM maupun dengan BOM sama-sama lolos selama byte-nya bersih.
 *
 * Offset byte dihitung dengan lebar UTF-8 per code point (1 byte
 * ASCII, 2 byte U+0080-U+07FF, 4 byte astral) agar pesan error tetap
 * benar bila payload berasal dari dekode byte mentah.
 *
 * Modul PURE: tanpa import server/, store/, UI, tanpa filesystem.
 */

/** Kategori pelanggaran charset yang dikenali gate. */
export type CharsetGateErrorCode =
  | 'c0_control'
  | 'del'
  | 'c1_control'
  | 'noncharacter'
  | 'non_ascii';

/** Satu pelanggaran charset: lokasi byte, kategori, dan pesan siap tampil. */
export interface CharsetGateError {
  code: CharsetGateErrorCode;
  /** Offset byte (0-based, lebar UTF-8) posisi pelanggaran. */
  byteOffset: number;
  /** Pesan manusiawi yang selalu menyebut offset byte. */
  message: string;
}

/** Berkas bersih: payload tanpa BOM siap masuk pemrosesan lanjut. */
export interface CharsetGateOk {
  ok: true;
  text: string;
}

/** Berkas ditolak: fail-closed, satu pelanggaran cukup. */
export interface CharsetGateReject {
  ok: false;
  errors: CharsetGateError[];
}

export type CharsetGateResult = CharsetGateOk | CharsetGateReject;

function formatCodePoint(cp: number): string {
  if (cp <= 0xff) return `0x${cp.toString(16).toUpperCase().padStart(2, '0')}`;
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

function utf8Width(cp: number): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

function classifyForbidden(cp: number): CharsetGateErrorCode {
  if (cp >= 0x80 && cp <= 0x9f) return 'c1_control';
  if (cp === 0x7f) return 'del';
  if (cp === 0xfffe || cp === 0xffff) return 'noncharacter';
  if (cp < 0x20) return 'c0_control';
  return 'non_ascii';
}

function categoryLabel(code: CharsetGateErrorCode): string {
  switch (code) {
    case 'c0_control':
      return 'control C0 di luar 09/0A/0D';
    case 'del':
      return 'DEL 0x7F';
    case 'c1_control':
      return 'control C1 0x80-0x9F';
    case 'noncharacter':
      return 'noncharacter U+FFFE/U+FFFF';
    case 'non_ascii':
      return 'byte di luar rentang ASCII spec';
  }
}

const ALLOWED_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0d]);

function isAllowed(cp: number): boolean {
  return ALLOWED_CONTROL_BYTES.has(cp) || (cp >= 0x20 && cp <= 0x7e);
}

/**
 * Periksa payload byte-level spec GEDCOM 7, strip BOM awal bila ada,
 * lalu kembalikan payload bersih atau daftar error fail-closed.
 */
export function runCharsetGate(payload: string): CharsetGateResult {
  const withoutBom = payload.startsWith('\uFEFF') ? payload.slice(1) : payload;
  const errors: CharsetGateError[] = [];
  let byteOffset = 0;
  for (const ch of withoutBom) {
    const cp = ch.codePointAt(0) as number;
    if (!isAllowed(cp)) {
      const code = classifyForbidden(cp);
      errors.push({
        code,
        byteOffset,
        message: `${formatCodePoint(cp)} pada offset byte ${byteOffset} ditolak: ${categoryLabel(code)} terlarang spec GEDCOM 7.`,
      });
    }
    byteOffset += utf8Width(cp);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, text: withoutBom };
}
