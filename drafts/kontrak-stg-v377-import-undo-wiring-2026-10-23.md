# Kontrak Stemmagraph v377: Import Undo Wiring (eksekutor undo + tombol undo di ImportControls)

Tanggal: 23 Okt 2026 (wake-138). Penulis kontrak: PM Ardi. Branch kerja: `improve/stg-v377-import-undo-wiring` (SUDAH dibuat PM dari develop, ced3680). Eksekutor: fullstack (Raka).

## Dasar
- v376 merged (ced3680): modul pure `buildUndoPlan` di `src/lib/gedcom/importUndoPlan.ts` menghasilkan `UndoPlan` (memberIdsToDelete, relationCountToReverse, safe, conflicts) dari ImportApplyReport + existingIds. Belum ada eksekusi nyata dan belum ada jalur undo ke pengguna (anti-dup bersih terverifikasi PM: nihil applyUndoPlan/undoImport/UndoBanner di develop).
- VISION Stemmagraph: permanensi data, GEDCOM native, produk murni. Undo import = emergency exit wajib untuk aksi skala besar (jangkar NN/g heuristik #3, evidence Sena wake-138).
- GEDCOM 7.0.18: XREF tidak dipertahankan antar stream, identifikasi record wajib lewat id internal DB (sudah dipenuhi v376 via createdMembers).

## Scope
1. Modul baru `src/lib/gedcom/executeUndoPlan.ts` (wiring layer, pola applyImportPlan: io disuntikkan, tanpa import server/, tanpa Date sistem, tidak pernah melempar):
   - `executeUndoPlan(plan, treeId, io)` menerima UndoPlan (bentuk apa pun, divalidasi level bentuk), treeId, dan io: `listRelationships(treeId)`, `deleteRelationship(id)`, `deleteMember(id)`.
   - Urutan: hapus dulu relasi yang menyentuh id di memberIdsToDelete (memberId ATAU relatedId masuk set), lalu hapus member satu per satu.
   - Id member di-dedupe urut kemunculan (pertahanan ekstra meski plan sudah distinct).
   - Jujur per entri: gagal satu entri dicatat dan lanjut entri berikutnya, tidak pernah throw.
   - `UndoExecuteReport`: `invalidInput: boolean`, `deletedMemberIds: string[]`, `removedRelationIds: string[]`, `failedMembers: {id, error}[]`, `failedRelations: {id, error}[]`. Bentuk plan buruk = report dengan invalidInput true tanpa throw.
   - Relasi yang tidak menyentuh member buatan import TIDAK disentuh.
2. Wiring UI di `src/components/FamilyTree/controls/ImportControls.tsx`:
   - Sebelum `applyImportPlan`: ambil `existingIds` via `adapter.listMembers(treeId)` (snapshot pra-import).
   - Setelah import sukses: bangun plan via `buildUndoPlan({ report: applyReport, existingIds })`, simpan di state; tampilkan tombol undo di panel ringkasan HANYA bila `plan.safe` dan ada karya (memberIdsToDelete.length > 0 ATAU relationCountToReverse > 0).
   - Klik undo: panggil `executeUndoPlan` dengan io adapter (`listRelationships`, `deleteRelationship`, `deleteMember`), lalu `fetchMembers(treeId)` refresh. Saat berjalan tombol disabled (anti klik ganda). Selesai: tampilkan ringkasan jumlah anggota dan relasi dihapus; bila ada kegagalan per entri ATAU executor lempar kondisi invalid, tampilkan pesan gagal jujur, bukan diam.
   - Plan tidak safe: JANGAN tampilkan tombol, tampilkan pesan konflik dengan jumlah konflik.
   - Import baru me-reset state undo sebelumnya.
   - Tanpa ubah perilaku fase sitasi dan pesan error existing.
3. i18n `src/lib/i18n/locales/id/common.json` + `en/common.json`, sub-kunci `import.undo`: `button`, `busy`, `done` (interpolasi {{members}} {{relations}}), `unsafe` ({{count}}), `failed`. Bahasa Indonesia dan Inggris setara makna, tanpa em dash.

## AC (gate QA)
1. `vitest` dedikasi lulus: test unit `executeUndoPlan` minimal 8 kasus (happy path urutan relasi dulu baru member terverifikasi lewat urutan panggilan io, dedupe id, bentuk plan buruk invalidInput tanpa throw, gagal satu member lanjut berikutnya, gagal satu relasi lanjut, relasi tak terkait tidak disentuh, plan kosong tanpa karya, relasi menyentuh member gagal delete tetap terhapus dan dilapor).
2. Test komponen baru `ImportControls.undo-wiring.test.tsx` minimal 6 kasus (tombol undo tampil pasca import sukses, klik undo memanggil io dengan id benar dan menampilkan ringkasan, klik ganda diblok saat berjalan, plan konflik tidak menampilkan tombol dan menampilkan pesan unsafe, import tanpa karya tidak menampilkan tombol, import baru me-reset undo sebelumnya). Semua mock modul lib, pola file test sitasi existing.
3. `npm run build` rc 0, `npx tsc --noEmit` 0, `npm run lint` 0 error di file baru/ubah (warning pre-existing file lain dianggap warisan).
4. Scope diff TEPAT: modul baru + test unit baru + test komponen baru + ImportControls.tsx + dua file i18n. Tidak ada perubahan lockfile, tidak ada file lain.
5. PURE CORE: nihil kode billing/premium/paywall/subscription.
6. Em dash 0 di semua file baru/ubah dan pesan komit.
7. Commit granular + push per komit ke origin branch `improve/stg-v377-import-undo-wiring` (WAJIB push tiap komit, jangan tumpuk di working tree).

## Non-goals
- Jendela waktu hitung mundur, kebijakan aksi dependen menutup undo, race dua sesi (draft v378 Sena, item terpisah).
- Undo multi-level, selective undo per record, redo.
- Perubahan semantik v373/v375/v376.

## Acuan gaya
Pesan komit dan kode mengikuti pola v376 (bahasa Indonesia teknis, tanpa em dash, tanpa klaim berlebih).