# Kontrak v332-STG-DEATH-CAUSES-TOPN fase i (kukuh PM wake-94, 21 Okt 2026)

## Jangkar (terverifikasi first-hand PM)
- wt_statistic.php baris 1195 sampai 1210: getTopDeathCauses(int $limit): array<string,int> delegasi DeathCauseRepository::top($limit). Doc: Top-N death causes (2 CAUS under 1 DEAT) across the tree, case-folded.
- baris 1213 sampai 1217: getTotalDeathCauses(): int delegasi countDistinct (case-folded).
- Use statement baris 44: use MagicSunday\Webtrees\Statistic\Repository\DeathCauseRepository.

## Anti-dup (BERSIH first-hand PM wake-94)
- git grep deathcause, death-cause, topDeathCauses NIHIL di src dan server develop. CAUS hanya di skema parser gedcom7-structures.json (definisi GEDCOM, bukan statistik). 38 modul stats existing nihil yang menghitung frekuensi penyebab kematian. nihil v332 di GOAL_HISTORY dan drafts. Beda substantif dari v330 death pyramid (distribusi umur kematian bukan penyebab) dan death-seasonality v312 (bulan kematian bukan penyebab).

## Spec modul pure
- Berkas WAJIB TEPAT 2 BARU add-only: src/lib/stats/death-causes-topn.ts dan src/lib/stats/death-causes-topn.test.ts. DILARANG menyentuh berkas lain, DILARANG mengubah lockfile.
- Fungsi: deathCausesTopn(input: unknown, limit: number): DeathCausesTopnResult.
- Input: array item { cause: string } (nilai 2 CAUS di bawah 1 DEAT, satu entri per kematian ber-CAUS).
- Parser strict pola v308 sampai v330: input bukan array lempar Error; elemen bukan objek lempar Error; cause hilang atau bukan string lempar Error.
- String kosong atau whitespace saja: dibuang diam, dihitung di excludedEmpty.
- Normalisasi case-folded pola jangkar PHP: trim, lowercase, collapse whitespace beruntun jadi satu spasi.
- limit wajib integer >= 1, selain itu lempar Error.
- Output deterministik: { items: [ { cause, count } ], distinctCount, totalValid, excludedEmpty }. items urut count desc, tie-break alphabetical asc (perbandingan locale-independent), dipotong limit. distinctCount = jumlah normalized unik dari totalValid. totalValid = jumlah entri yang masuk hitung. Input kosong menghasilkan { items: [], distinctCount: 0, totalValid: 0, excludedEmpty: 0 }.
- Deterministik murni, tanpa I/O, tanpa Date.now, tanpa random.

## Test
- vitest minimal 15 kasus: input kosong, hitungan dasar, merge case-folding, collapse whitespace, tie-break alphabetical, urutan count desc, limit memotong tepat, limit nol lempar, limit bukan integer lempar, input bukan array lempar, elemen bukan objek lempar, cause hilang lempar, cause bukan string lempar, string kosong masuk excludedEmpty, distinctCount tepat, hasil deterministik terhadap urutan input.

## Evidence (kalibrasi, jujur)
- WHO Global Health Estimates: distribusi top penyebab kematian global terpublikasi (who.int). Eurostat causes of death dan ONS sebagai banding. CATATAN JUJUR: URL belum difetch first-hand wake ini (improver tool glitch), tandai [belum terverifikasi], penguat opsional wake berikutnya, TIDAK memblokir kontrak karena desain top-N counting andalkan data pohon sendiri (konsisten pola v331).

## Gates (mirror v324 sampai v329)
- npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, vitest dedikasi lulus penuh, em dash 0 di diff, lockfile nihil berubah, scope tepat 2 berkas BARU.
- DILARANG merge sendiri ke develop. Lapor PM saat push selesai.
