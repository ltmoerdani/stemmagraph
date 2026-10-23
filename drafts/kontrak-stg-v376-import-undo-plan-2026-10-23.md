# Kontrak Stemmagraph v376: Import Undo Plan (rencana pengembalian pasca import, lanjutan rantai GAP #2)

Tanggal: 23 Okt 2026, wake-136 lanjutan. Penurun kontrak: PM Ardi. Dasar: draft cadangan Sena v375 Import Undo/Rollback (deposited sisi improver wake-135, substansi diadopsi PM setelah dispatch mati), pipeline fill mandiri PM setelah v375 closed. Dasar konsep: applyImportPlan dua fase (member dulu lalu relasi, ImportApplyReport jujur per entri) menghasilkan createdMembers dengan id internal nyata; undo yang aman hanya menyentuh apa yang DIBUAT import terakhir, bukan revert semesta.

## Konteks
v375 (0bfa946 di develop) menutup pelaporan pasca import. Kebutuhan lanjutan alami: operator salah import berkas, ingin mengembalikan pohon ke kondisi sebelum import TANPA menyentuh data lama. Undo parsial dengan id internal eksplisit memenuhi itu tanpa mekanisme transaksi DB.

## Deliverable (maksimal 2 berkas baru, tanpa ubah berkas lain, tanpa ubah lockfile)
1. src/lib/gedcom/importUndoPlan.ts (modul pure)
2. src/lib/gedcom/importUndoPlan.test.ts (vitest, minimal 15 kasus)

## Input: buildUndoPlan(payload)
Objek dengan dua bagian:
- report: ImportApplyReport bentuk nyata dari applyImportPlan.ts: { createdMembers: Array<{ xref?: string, id: string }>, duplicateXrefs: Array<string | undefined>, failedMembers: Array<{ xref?: string, error: string }>, createdRelations: number, skippedRelations: Array<{ memberXref: string, relatedXref: string, reason: string }>, failedRelations: Array<{ memberXref: string, relatedXref: string, error: string }>, memberWarnings: Array<{ xref?: string, warning: string }> }
- existingIds: Array<string> (semua id internal yang ada di pohon SEBELUM import dijalankan)

## Output: UndoPlan satu blok terstruktur
memberIdsToDelete: id internal urut input tanpa duplikat, hanya id yang BENAR-BENAR dibuat import terakhir (ada di createdMembers DAN tidak ada di existingIds). relationCountToReverse: createdRelations apa adanya (angka agregat, wiring layer yang membalik per relasi nyata). safe: boolean true hanya bila semua id di createdMembers tidak ada di existingIds. conflicts: array { id, detail } untuk setiap id createdMembers yang SUDAH ada di existingIds (indikasi id tabrakan, undo DILARANG menyentuh id itu, detail menyebut konflik existing-tree).

## Aturan angka
1. memberIdsToDelete = createdMembers.id distinct yang bukan anggota existingIds, urutan kemunculan pertama dipertahankan.
2. conflicts tanpa entri = array kosong, safe = conflicts.length === 0.
3. duplicateXrefs, failedMembers, skippedRelations, failedRelations, memberWarnings TIDAK mengubah plan undo (bukan karya import yang berhasil), hanya createdMembers dan createdRelations yang dibalik.
4. Modul pure: tanpa DB, tanpa Date sistem, tanpa IO, tidak pernah melempar pada bentuk input buruk: bentuk buruk menghasilkan plan kosong { memberIdsToDelete: [], relationCountToReverse: 0, safe: false, conflicts: [{ id: '', detail: 'invalid-input' }] }.

## Kasus test wajib (minimal 15)
(1) import bersih semua id baru masuk delete list urut input; (2) id duplikat di createdMembers dihilangkan; (3) id sudah ada di existingIds masuk conflicts dan KELUAR dari delete list; (4) safe true tanpa konflik; (5) safe false dengan konflik; (6) relationCountToReverse mirror createdRelations; (7) failedMembers tidak memengaruhi plan; (8) skippedRelations tidak memengaruhi plan; (9) duplicateXrefs tidak memengaruhi plan; (10) createdMembers tanpa xref tetap diproses lewat id; (11) existingIds kosong berarti semua created masuk delete; (12) report kosong menghasilkan plan kosong safe false invalid-input; (13) bentuk buruk beragam (null, array, field hilang, tipe salah) semua plan kosong tanpa lempar; (14) urutan delete list deterministik lintas urutan input existingIds; (15) kombinasi konflik parsial: sebagian id konflik sebagian bersih.

## Gaya dan git
Em dash 0 di semua berkas dan pesan komit. Komentar kode bahasa Indonesia pola modul stats lain. Commit granular dan PUSH PER KOMIT ke origin. JANGAN merge ke develop: PM yang memerintahkan merge setelah QA.

## Non-goals
Tanpa eksekusi penghapusan nyata (wiring layer menyuntik io, pola applyImportPlan). Tanpa undo multi langkah (satu import terakhir). Tanpa sentuh semantik v373/v375. Tanpa kode komersial (PURE CORE).

## Sumber
1. Draft cadangan Sena v375 Import Undo/Rollback, sisi improver, substansi diadopsi wake-136.
2. src/lib/gedcom/applyImportPlan.ts develop (ImportApplyReport, bentuk input nyata).
3. develop 0bfa946 (v375 import merge statistics).
