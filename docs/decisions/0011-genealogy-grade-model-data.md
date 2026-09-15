# ADR 0011: Model data genealogi-grade

## Status

Proposed (draft S1, 11 September 2026). Disetujui Pak untuk fase draft (GO 10 Sep 2026 "approve semaunya", eksekusi berfase). Belum Accepted: cutover menunggu rehearsal migrasi di dump data dan QA terpisah.

## Context

GAP #1 visi Stemmagraph: model data belum genealogi-grade. Kondisi `prisma/schema.prisma` hari ini:

- `FamilyMember.birthDate` dan `deathDate` bertipe `String` bebas. Tidak ada cara membedakan "12 Mar 1945", "sekitar 1945", "sebelum 1950", atau tanggal yang hanya diketahui tahunnya. Kalkulator kekerabatan dan export GEDCOM harus menebak.
- `gender` adalah `String @default("male")`. Nilai lain tidak terkontrol, `unknown` tidak ada, dan default ke "male" adalah bias data.
- Tempat adalah teks bebas (`birthPlace`, `currentLocation`). Tidak ada entitas Place, jadi tidak bisa dinormalisasi, di-share, atau dipetakan antar anggota yang lahir di tempat yang sama.
- Tidak ada Source dan Citation. Silsilah tanpa sumber hanyalah rumor yang rapi.
- Multi-pasangan hanya tersirat lewat `maritalStatus` dan baris `FamilyRelationship`; tidak ada pasangan pernikahan yang eksplisit dengan tanggal dan tempat pernikahan.

Akibatnya empat fitur visi tertahan: consent flow penuh, marga dan multi-pasangan, kalkulator kekerabatan yang benar, dan presisi import GEDCOM. Gate T0-T1 visi sudah 2 dari 4; dua sisanya diblokir model data ini.

## Decision

Lima keputusan desain (add-only, tanpa menghapus atau mengubah kolom existing pada fase ini):

1. **Tanggal bertipe.** Setiap tanggal kejadian hidup disimpan sebagai komposit: `dateKind` (`EXACT | ABOUT | BEFORE | AFTER | RANGE`), `year`/`month`/`day` sebagai `Int?`, `yearEnd`/`monthEnd`/`dayEnd` untuk RANGE, plus `originalDateString` yang menyimpan tulisan asli sumber. Aturan kebenaran: persisi yang disimpan tidak pernah lebih tegas daripada sumbernya.
2. **Gender terkontrol.** Enum `MALE | FEMALE | UNKNOWN | OTHER`, tanpa default yang memihak. Nilai lama "male"/"female" dimigrasi berkala; nilai tak dikenal menjadi `UNKNOWN`.
3. **Place sebagai entitas.** `Place` dengan nama tampil, nama ternormalisasi untuk pencocokan, dan tempat opsional untuk koordinat. Kolom teks existing (`birthPlace` dll.) tetap ada sebagai teks; entitas Place dirujuk dari kejadian hidup baru.
4. **Source dan Citation.** `Source` adalah sumber dokumen (buku, arsip, akta, URL arsip digital). `Citation` merujuk satu Source dengan kualifier (halaman, nomor akta) dan transkripsi opsional. Kejadian hidup merujuk Citation, bukan langsung Source.
5. **Multi-pasangan eksplisit.** Pernikahan menjadi `LifeEvent` bertipe `MARRIAGE` yang mengaitkan dua anggota, plus `FamilyRelationship` bertipe pasangan tetap jadi tulang punggung graf. Cerai (`DIVORCE`) dan pasangan tanpa pernikahan (`PARTNER`) jadi tipe kejadian/relasi tersendiri.

Skema lengkap ada di `prisma/schema-genealogy-draft.prisma` (DRAFT, tidak dimuat generator; lihat kepala berkas). Model `LifeEvent` meliputi `BIRTH | DEATH | MARRIAGE | DIVORCE | PARTNERSHIP | ADOPTION | CENSUS | IMMIGRATION | EMMIGRATION | BURIAL | BAPTISM | OCCUPATION | RESIDENCE | OTHER`.

## Pemetaan GEDCOM 7

| GEDCOM 7 | Target skema draft | Catatan |
|---|---|---|
| `INDI.SEX` | `PersonDraft.gender` (enum Gender) | `U` dan kosong menjadi `UNKNOWN` |
| `INDI.BIRT.DATE` | `LifeEvent(BIRTH).date*` | `ABT` ke ABOUT, `BEF` ke BEFORE, `AFT` ke AFTER, `FROM/TO` ke RANGE |
| `INDI.DEAT.DATE` | `LifeEvent(DEATH)` | sama seperti atas |
| `INDI.CHR`, `INDI.BAPM` | `LifeEvent(BAPTISM)` | |
| `INDI.BURI` | `LifeEvent(BURIAL)` | |
| `INDI.OCCU` | `LifeEvent(OCCUPATION)` | nilai ke dalam `detail` |
| `INDI.RESI` | `LifeEvent(RESIDENCE)` | |
| `FAM.MARR` | `LifeEvent(MARRIAGE)` mengaitkan HUSB+WIFE | `DIV` ke `DIVORCE` |
| `FAM` tanpa `MARR` (HUSB/WIFE ada) | `FamilyRelationship` pasangan + opsional `PARTNERSHIP` | pasangan tanpa tanggal pernikahan tetap eksplisit |
| `INDI.FAMC` / `INDI.FAMS` | relasi anak-anak existing (`FamilyRelationship` anak) | tidak berubah |
| `INDI.BIRT.PLAC` | `LifeEvent.placeId` ke `Place` | nama tampil dari `PLAC`, ternormalisasi untuk pencocokan |
| `INDI.SOUR` | `Citation` ke `Source` | `PAGE` ke kualifier, `NOTE`/`DATA.TEXT` ke transkripsi |
| `INDI.NOTE` (tanpa SOUR) | `LifeEvent.notes` / anggota | teks bebas tetap teks bebas |
| Tanggal tak terurai | `originalDateString` + `dateKind=ABOUT` | aturan kejujuran: jangan mengarang presisi |

## Strategi migrasi bertahap

- **Fase 1 (draft ini):** berkas skema draft terpisah, nol sentuhan ke `schema.prisma`, nol migrasi database. Kode existing tidak dapat rusak.
- **Fase 2 (menyusul):** gabung add-only ke `schema.prisma`, migrasi Prisma add-only (tabel baru + kolom nullable), backfill skrip: parse `birthDate`/`deathDate` teks menjadi `LifeEvent` dengan `originalDateString` terjaga, gender lama dipetakan ke enum.
- **Fase 3 (cutover):** hanya setelah rehearsal lulus: restore dump produksi ke database staging, jalankan migrasi penuh, rekonsiliasi hitung baris (anggota vs kejadian BIRTH/DEATH) dan spot-check 20 baris acak, ukur durasi. Temuan rehearsal jadi prasyarat keputusan cutover (keputusan terpisah, ke Pak).
- **Rollback:** fase 1 dan 2 memundurkan bersih (tabel/kolom baru dihapus); fase 3 butuh jendela dan backup pra-migrasi.

## Konsekuensi

- Kebenaran genealogis jadi bisa diekspresikan: "lahir sekitar 1945, tercatat di akta no. 88, lihat arsip X".
- Kalkulator kekerabatan dan export GEDCOM berhenti menebak; import GEDCOM 7 punya rumah yang jujur untuk setiap klaim.
- Biaya: satu lapisan model baru dan backfill yang harus diuji; itulah sebabnya fase 3 digerbangi rehearsal, bukan kepercayaan.
- Risiko utama: date parse backfill salah presisi. Mitigasi: `originalDateString` tidak pernah ditimpa, parse boleh gagal ke `ABOUT` tanpa kehilangan data.

## Next steps (di luar draft ini)

Parser tanggal teks (lib murni beruji), migrasi fase 2, rencana rehearsal terinci dengan dump asli.
