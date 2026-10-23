# Kontrak Stemmagraph v373: Import Merge Plan dan Remap XREF (GAP #2)

- Tanggal: 23 Okt 2026 (wake-134). Branch kerja: `improve/stg-v373-import-merge-xref-remap` dari develop. Eksekutor: fullstack.
- Latar: GEDCOM 7.0.18 bagian 1.3, XREF hanya unik dalam satu data document dan tidak dipertahankan antar data stream, jadi XREF dilarang jadi kunci penggabungan dua berkas. Identitas lintas berkas hanya lewat UID, EXID, REFN. Modul `src/lib/gedcom/importMergePlan.ts` (272 baris, pure) sudah ada di branch hasil salvase PM, belum ada test.
- Anti-dup: bersih, nihil importMergePlan/merge-plan serupa di develop (terverifikasi PM 23 Okt wake-134).

## Tugas

Test dedikasi `src/lib/gedcom/importMergePlan.test.ts` (vitest) untuk modul yang sudah ada. Modul tidak diubah kecuali bug nyata ditemukan; kalau diubah, sebut alasan di pesan komit.

## AC

1. Test pure: tanpa import server, tanpa Date, tanpa I/O, tanpa network.
2. Kasus wajib (minimal):
   - buildMergePlan: remap semua xref masuk dapat ID internal baru `@M<n>@` tanpa tabrakan, hormati `usedIds` existing dan `startCounter` non-1.
   - xrefMap berisi peta xref sumber ke ID baru; remapPointer memetakan pointer terdaftar; pointer tak terdaftar kembali apa adanya (tidak difabrikasi).
   - Prioritas pencocokan durable: EXID bertipe dulu, lalu UID, lalu REFN; kecocokan pertama menang; hasil hanya MATCH_CANDIDATE (tidak ada status MERGED otomatis, tidak ada auto-merge).
   - EXID tanpa TYPE tidak dipakai pencocokan otomatis (status NEW kecuali kena jalur UID/REFN).
   - Input rusak: incoming bukan array, record null/bukan objek, source tak dikenal: masuk skipped dengan skipReason dan tetap tercatat di entries; fungsi tidak pernah melempar.
   - extractDurableIdentity: UID level 1, REFN level 1, EXID level 1 dengan TYPE level 2 subordinate; EXID tanpa TYPE hasil type undefined; pendingExidType reset setelah EXID; baris rusak dilewati tanpa throw; input bukan array hasil identitas kosong.
   - firstPreferred: nilai pertama yang terisi menang, urutan dipertahankan.
   - Determinisme: input sama dipanggil ulang hasil identik.
3. Gate QA: npm ci (lockfile nihil berubah), vitest file test baru standalone lulus penuh, npm run build rc 0, npm run lint 0 error di berkas baru, em dash 0 di semua berkas dan pesan komit, pure core bersih (tidak ada isPremium/paywall/billing/subscription di berkas baru), scope TEPAT: kontrak + modul + test baru.
4. ATURAN GIT WAJIB: repo stemmagraph `/home/zeroclaw/projects/stemmagraph`, branch `improve/stg-v373-import-merge-xref-remap` SUDAH ADA (checkout branch itu, JANGAN buat baru). Commit granular + PUSH PER KOMIT ke origin (`git push origin improve/stg-v373-import-merge-xref-remap`) setiap selesai komit. Sebelum selesai: `git merge develop` ke branch (saat ini no-op, tip identik), resolve konflik bila ada, push. Lapor: repo, file diubah, hasil vitest/build/lint, hash komit, nama branch. JANGAN merge ke develop, JANGAN sentuh main/staging.
