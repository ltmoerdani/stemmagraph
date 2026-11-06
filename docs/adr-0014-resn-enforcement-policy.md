# ADR 0014: Kebijakan enforcement tiga level RESN (v423 AC2d)

Tanggal: 2026-11-06. Status: diterima. Mengimplementasikan GOAL v423 AC2.

## Konteks

GEDCOM 7 mendefinisikan RESN sebagai List of Enum dengan tiga nilai:
CONFIDENTIAL, PRIVACY, LOCKED. Field verbatim disimpan apa adanya di kolom
`FamilyMember.resnVerbatim` (migrasi 20261106030000, additive nullable)
agar round-trip export tidak kehilangan bentuk asli (Pilar 1 portabilitas).

## Keputusan

1. CONFIDENTIAL: axis baca. Member tidak muncul di path baca normal
   (list dan GET by id balas 404 bentuk identik member nihil, anti-enumerasi).
   Implementasi: `isResnHidden` di `src/lib/privacy/resn-enforcement.ts`.
2. LOCKED: axis mutasi. Edit (PUT) dan delete (DELETE) ditolak 403
   `MEMBER_LOCKED` sebelum guard role, konsisten pola error server existing.
   Implementasi: `isResnLocked`.
3. PRIVACY: tanpa logika baru. Tetap lewat gerbang ekspor existing
   (`exportPrivacyGate`, `public-tree`, `member-redaction`).
4. Fail-closed: verbatim kosong atau whitespace = baseline utuh (bukan
   nilai tak dikenal), perilaku data lama tidak berubah. Kombinasi multi
   nilai di-resolve merge OR paling membatasi lewat resolver komposit AC1
   (`resolveResnComposite`). Token yang tidak dikenal dari enumset
   diperlakukan paling membatasi: hidden dan locked sekaligus; data
   malformed tidak pernah melebarkan akses.
5. LOCKED meliputi axis hidden (hidden true), sesuai semantik komposit
   AC1: LOCKED OR PRIVACY = LOCKED.

## Konsekuensi

- Data lama tanpa RESN tidak terdampak sama sekali (kolom nullable,
  null = baseline utuh).
- Export GEDCOM tetap menghasilkan berkas parse valid; enforcement hanya
  menyentuh path baca dan mutasi API, tidak menyentuh serialisasi export.
- PENGA-edit harus menghapus atau mengubah RESN lewat jalur administrasi
  (record LOCKED tidak bisa diedit lewat API normal), sesuai semantik
  GEDCOM 7 restriction sebagai kontrol editorial.
