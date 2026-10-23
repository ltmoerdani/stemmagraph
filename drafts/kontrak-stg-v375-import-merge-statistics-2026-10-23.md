# Kontrak Stemmagraph v375: Import Merge Statistics (ringkasan pasca import merge, lanjutan GAP #2)

Tanggal: 23 Okt 2026, wake-136. Penurun kontrak: PM Ardi. Dasar: draft Sena v374 Import Statistics (reports/draft-goal-stg-v374-import-statistics-2026-10-23.md) tervalidasi inline dengan VISION-stemmagraph (pilar statistik keluarga, rantai import GAP #2), dengan adaptasi scope oleh PM (lihat bawah). Pola pelaporan ditiru dari importer Gramps (plugin per format, laporan pasca import), bukan menyalin implementasi.

## Konteks
v373 (develop, 8a09718) menghasilkan buildMergePlan: entries berstatus NEW/MATCH_CANDIDATE/SKIPPED plus xrefMap plus skipped. applyImportPlan menghasilkan ImportApplyReport: createdMembers, duplicateXrefs, failedMembers, createdRelations, skippedRelations berreason, failedRelations, memberWarnings. Hasil itu belum punya ringkasan terbaca manusia. Item ini menambah modul PURE peringkas statistik pasca import merge, TANPA menyentuh semantik v373 dan tanpa I/O.

## Deliverable (maksimal 2 berkas baru, tanpa ubah berkas lain, tanpa ubah lockfile)
1. src/lib/stats/import-merge-statistics.ts (modul pure)
2. src/lib/stats/import-merge-statistics.test.ts (vitest, minimal 14 kasus)

## Input: computeImportMergeStatistics(payload)
Objek dengan tiga bagian (nama field sejajar types nyata di importMergePlan.ts dan applyImportPlan.ts):
- plan: { entries: Array<{ source: 'INDI' | 'FAM', status: 'NEW' | 'MATCH_CANDIDATE' | 'SKIPPED', matchType?: 'EXID' | 'UID' | 'REFN' }>, skipped: Array<{ source: 'INDI' | 'FAM' }>, xrefMap: Record<string, string> }
- report: { createdMembers: Array<{ xref?: string }>, duplicateXrefs: Array<string | undefined>, failedMembers: Array<{ xref?: string, error: string }>, createdRelations: number, skippedRelations: Array<{ reason: string }>, failedRelations: Array<{ error: string }>, memberWarnings: Array<{ warning: string }> }
- treeBefore: { persons: number, families: number }

## Output: satu blok ringkasan berkunci stabil
personsIncoming, familiesIncoming, personsNew, familiesNew, matchCandidates { total, byEXID, byUID, byREFN }, skippedInput { total, byReason }, xrefsRemapped, duplicatesDetected, membersFailed, relationsCreated, relationsSkipped { total, byReason }, relationsFailed, memberWarnings { total, byWarning }, treeBefore { persons, families }, treeAfter { persons, families }, delta { persons, families }.

## Aturan angka
1. Distinct counting: duplicatesDetected = jumlah xref DISTINCT di duplicateXrefs (acuan kasus 8 v372: trim plus skip plus dedup = distinct). xrefsRemapped = jumlah kunci xrefMap.
2. Invariant wajib: personsIncoming = personsNew + matchCandidates.total + skippedPersons; familiesIncoming mirror sama. Incoming = entries plus skipped per source.
3. treeAfter = treeBefore + New per kategori; delta = New. MATCH_CANDIDATE tidak menambah tree (kandidat bukan merge, keputusan milik pemanggil).
4. byReason dan byWarning: kunci string terurut ASC (deterministik), tanpa entri = objek kosong.
5. Semua angka non-negatif integer.

## Parser strict (pola v370/v373/v374, prefiks import-merge-statistics)
DILEMPAR Error ber-index (bukan difilter diam-diam) untuk: payload, plan, report, atau treeBefore bukan objek; tujuh array di plan/report bukan array; entri bukan objek atau source atau status invalid; xrefMap bukan objek string ke string; createdRelations, treeBefore.persons, atau treeBefore.families negatif atau non-integer atau hilang; reason, warning, atau error bukan string. Input kosong (array kosong, xrefMap kosong, treeBefore 0 0) VALID: output nol, treeAfter sama dengan treeBefore, delta 0.

## Kasus test wajib (minimal 14)
(1) import kosong valid nol delta 0; (2) campuran INDI/FAM NEW; (3) breakdown byEXID byUID byREFN kunci selalu lengkap walau satu jalur nol; (4) skippedInput byReason; (5) remap bertumpuk: banyak kunci xrefMap tetap dihitung distinct kunci; (6) semua duplikat: duplicatesDetected distinct, created nol; (7) error parsial: failedMembers sebagian tanpa menggagalkan hitungan created; (8) distinct counting acuan v372 kasus 8 (duplicateXrefs berulang dihitung 1); (9) invariant personsIncoming; (10) invariant familiesIncoming; (11) delta dan treeAfter; (12) memberWarnings byWarning; (13) payload invalid lempar ber-index; (14) angka negatif lempar; (15) non-integer lempar; (16) kunci byReason terurut ASC deterministik lintas urutan input.

## Gaya dan git
Em dash 0 di semua berkas dan pesan komit. Komentar kode bahasa Indonesia pola modul stats lain. Commit granular dan PUSH PER KOMIT ke origin. JANGAN merge ke develop: PM yang memerintahkan merge setelah QA.

## Adaptasi scope vs draft Sena
Draft meminta kategori entity person family source note. Pipeline nyata hanya INDI dan FAM (MergePlan v373), jadi scope item ini person plus family; kategori source dan note ditunda sampai parser SOUR SNOTE tersedia (kandidat slot berikutnya). Adaptasi tercatat terbuka, bukan dipangkas diam-diam.

## Sumber
1. Draft Sena v374 Import Statistics, workspace PM, 23 Okt 2026.
2. Direktori importer Gramps, https://api.github.com/repos/gramps-project/gramps/contents/gramps/plugins/importer?ref=master , akses 23 Okt 2026.
3. notes/920 sesi 635: GEDCOM 7.0.18 bagian 1.3, XREF unik per data document.
4. develop: src/lib/gedcom/importMergePlan.ts dan src/lib/gedcom/applyImportPlan.ts (sumber bentuk input).
