/**
 * Pembalik escape at-sign pada payload import (STG v465 unit A1,
 * sisi import).
 *
 * Export aplikasi menggandakan karakter @ pada payload agar tidak
 * tertukar dengan pembatas pointer (@...@), sehingga nilai awal
 * '@Riwayat' tersimpan '@@Riwayat' di berkas GEDCOM (temuan wake-350:
 * export vendor sudah menggandakan @ awal). Saat import, penggandaan
 * di posisi awal payload harus dibalik: '@@Riwayat' dibaca
 * '@Riwayat'. Penggandaan murni '@@' dibaca '@'. Single @ di tengah
 * teks (mis. 'me@example.com') bukan hasil escape, dibiarkan utuh.
 *
 * Scope sesi ini hanya posisi awal payload; pola '@@' di tengah teks
 * ditunda ke sesi berikutnya bersama error pola seragam unit 1c.
 *
 * Modul PURE: tanpa import server/, store/, UI, tanpa filesystem.
 */

/** Collapse penggandaan '@' di posisi awal payload jadi satu '@'. */
export function unescapeLineValue(value: string): string {
  if (value.startsWith('@@')) {
    return '@' + value.slice(2);
  }
  return value;
}
