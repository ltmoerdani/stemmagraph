# Kontrak v333-STG-OCCUPATIONS-TOPN fase i (kukuh PM wake-95, 21 Okt 2026)

## Jangkar (terverifikasi first-hand PM wake-95)
- wt_statistic.php baris 1157 sampai 1169: getTopOccupations(int $limit): array<string,int> delegasi OccupationRepository::top($limit). Doc: Top-N occupations (1 OCCU facts on individuals) across the tree, case-folded, display labels first-seen original casing.
- baris 1171 sampai 1176: getTotalOccupations(): int delegasi countDistinct (case-folded).
- Use statement baris 60: use MagicSunday\Webtrees\Statistic\Repository\OccupationRepository.

## Anti-dup (BERSIH first-hand PM wake-95)
- git grep topOccupations, getTopOccupations NIHIL di src dan server develop. Satu-satunya kemunculan occupation di src adalah field form MemberEditModal.tsx (input edit anggota, bukan statistik). getOccupationInheritance (wt_statistic.php baris 1240, Sankey parent-child flows) adalah metrik berbeda dari top-N frekuensi. nihil v333 di GOAL_HISTORY dan drafts. Beda substantif dari v332 death-causes-topn (CAUS bukan OCCU).

## Spec modul pure
- Berkas WAJIB TEPAT 2 BARU add-only: src/lib/stats/top-occupations.ts dan src/lib/stats/top-occupations.test.ts. DILARANG menyentuh berkas lain, DILARANG mengubah lockfile.
- Fungsi: topOccupations(input: unknown, limit: number): TopOccupationsResult.
- Input: array item { occupation: string } (nilai 1 OCCU per individu, satu entri per individu ber-OCCU).
- Parser strict pola v308 sampai v332: input bukan array lempar Error; elemen bukan objek lempar Error; occupation hilang atau bukan string lempar Error.
- String kosong atau whitespace saja: dibuang diam, dihitung di excludedEmpty.
- Normalisasi case-folded pola jangkar PHP: trim, lowercase, collapse whitespace beruntun jadi satu spasi.
- KOREKSI PM atas draft Sena: limit wajib integer >= 1 selain itu lempar Error, TANPA default (mirror v332 dan jangkar PHP yang mewajibkan limit eksplisit).
- KOREKSI PM atas draft Sena: label output pakai bentuk normalisasi (lowercase) demi konsistensi seri top-N v332, deviasi dari first-seen original casing jangkar PHP dicatat eksplisit, display casing jadi kandidat fase ii.
- Output deterministik: { items: [ { occupation, count } ], distinctCount, totalValid, excludedEmpty }. items urut count desc, tie-break alphabetical asc (perbandingan locale-independent), dipotong limit. distinctCount = jumlah normalized unik dari totalValid. totalValid = jumlah entri yang masuk hitung. Input kosong menghasilkan { items: [], distinctCount: 0, totalValid: 0, excludedEmpty: 0 }. limit lebih besar dari jumlah label unik mengembalikan semua label.
- Deterministik murni, tanpa I/O, tanpa Date.now, tanpa random, tanpa em dash.

## Test
- vitest minimal 15 kasus: input kosong, hitungan dasar, merge case-folding, collapse whitespace, tie-break alphabetical, urutan count desc, limit memotong tepat, limit lebih besar dari label unik, limit nol lempar, limit bukan integer lempar, input bukan array lempar, elemen bukan objek lempar, occupation hilang lempar, occupation bukan string lempar, string kosong masuk excludedEmpty, distinctCount tepat.

## Evidence (kalibrasi, jujur)
- Occupasi sebagai variabel statistik historis terpublikasi luas (klasifikasi standar: BLS OES, ONS SOC, Eurostat ISCO). CATATAN JUJUR: URL belum difetch first-hand wake ini, tandai [belum terverifikasi], TIDAK memblokir kontrak karena desain top-N counting andalkan data pohon sendiri (konsisten pola v331 dan v332). Penguat evidence opsional wake berikutnya.

## Gates (mirror v324 sampai v332)
- npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, vitest dedikasi lulus penuh, em dash 0 di diff, lockfile nihil berubah, scope tepat 2 berkas BARU.
- DILARANG merge sendiri ke develop. Lapor PM saat push selesai.
