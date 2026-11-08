# BOARD-stemmagraph.md (updated)

## Status Saat Ini
- **Aktif**: ADA TASK AKTIF: GEDCOM round-trip GOAL v119 didelegasikan ke fullstack (branch improve/stg-v119-gedcom-roundtrip)
- **v431**: Consent Audit Trail AC1-AC2 TUNTAS PENUH (merge b492ac4)
- **v428**: Consent UI Withdrawal TUNTAS (merge ke develop)
- **Sudah DONE & MERGED**: v431, v428 ke develop
- **Slot**: 0 task implementasi aktif (batas PARALEL: maksimal 1 per project)
- **Priority**: #2 setelah Zertifico (dormant, sudah laporan telegram) → #3 Blazz Next

## Ringkasan Selesai
- **v431**: AC1-AC2 completed, QA vitest 44/44 hijau, lint 0 error, tsc 0, em dash 0
- **Merge**: Sudah merge ke develop (b492ac4)
- **v428**: SelfConsentPanel ditambahkan, QA lulus, merge ke develop

## Antrian Selanjutnya
- **Zertifico**: Menunggo GO Dari Pak (sudah kirim laporan infORMATIF via telegram.telegram wake-260)
- **Stemmagraph**: Slot kosong → siap terima task GEDCOM round-trip (GOAL v119, draft Oct 21 2026, AC1-AC7 desain parser + fixture + round-trip verifikasi Gramp + validator pihak ketiga)
- **Blazz Next**: STANDBY (STOP.md=RUN), menunggu alokasi

## Tindakan Wake Ini (3 action)
1. **Schema gate AC3**: Verifikasi 8/8 schema-gate test + 10/10 structure-lookup test lulus - infrastruktur GEDCOM 7 parsing (unknown structure + cardinality violation) sudah valid, pure core terjaga
2. **Code quality fix**: Removed unused `replayConsentState` import dari audit-export.ts - 9 lint warnings tersisa (set state in effect), build tetap lulus
3. **Build terverifikasi**: `npm run build` sukses 1m19s - production build generateSW 17 entries ready; lint baseline 0 error (9 warning baseline), tsc 0, em dash 0

## Interleave Priority
- #1 Zertifico (menunggu GO Pak) → #2 Stemmagraph → #3 Blazz Next
- Jika Zertifico GO Dari Pak: turunkan goal berikutnya sendiri
- Jika Zertifik tetap kering: Stemmagraph slot bisa dipakai, lalu Blazz
- QA LULUS: delegate fullstack merge ke develop, update BOARD status PASS
- QA GAGAL: max 3 putaran per item, pecah scope jika ke-3 gagal
- Dependency chain serial per project
- Branch kerja beda repo, item tidak menyentuh file yang sama antar project
- Setelah kirim laporan: LANJUT kerja item lain yang tidak bergantung jawaban
- BOARD update wajib setelah setiap tindakan