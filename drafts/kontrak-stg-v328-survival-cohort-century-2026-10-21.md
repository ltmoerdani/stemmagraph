# KONTRAK v328-STG-SURVIVAL-COHORT-CENTURY FASE I (2026-10-21)

## Jangkar
- wt_statistic.php / LifeSpanRepository.php baris 856: kurva kelangsungan hidup per kohort abad kelahiran (webtrees-statistics, tab Life span).
- Acuan metodologi kohort: Human Mortality Database (mortality.org) cohort lx tables; status verifikasi jujur tercatat Log BOARD wake-89.

## Anti-dup (verifikasi PM first-hand 21 Okt)
- survival-curve.ts existing: kohort per DEKADE (kunci "1970s", default) atau satu kohort "all" (cohortDecade false). NIHIL kohort abad.
- GOAL_HISTORY nihil v328. Grep survival-cohort NIHIL di src dan server.

## Scope (ADD-ONLY, TEPAT 2 berkas BARU)
1. src/lib/stats/survival-cohort-century.ts
2. src/lib/stats/survival-cohort-century.test.ts
Plus berkas kontrak ini (sudah di cabang). DILARANG menyentuh berkas existing apa pun, termasuk survival-curve.ts.

## Spesifikasi modul
- Interface input: SurvivalCohortMember { birthDate: string; deathDate: string | null } (pola survival-curve.ts).
- Kohort abad kelahiran: kunci "1800s", "1900s", dst dari floor(birthYear/100)*100. Tahun BCE negatif sah sbg lower bound, kunci tetap konsisten floor.
- Grid umur: 0,10,20,... kelipatan 10 sampai umur maksimum kohort, ASC (pola survival-curve.ts).
- Semantik selamat anniversary-aware whole years (pola v301/v307): meninggal sebelum umur A = tidak selamat pada A; hidup, atau meninggal pada atau sesudah umur A = selamat pada A. Catatan censored right dipertahankan jujur di doc comment.
- survivalFraction round 2 desimal, cohortSize integer. Kohort kosong nihil di output. Urutan kohort ASC, umur ASC.
- Parser strict YYYY-MM-DD pola v301/v307: format salah atau tanggal tidak valid kalender (termasuk kabisat) LEMPAR Error, TANPA silent-filter. deathDate sebelum birthDate DIBUANG dari kohort (pola v310).
- Deterministik murni: nihil I/O, nihil jam sistem, nihil randomness.

## Test (vitest, minimal 14 kasus)
Minimal mencakup: empty input, satu kohort tunggal, dua kohort abad beda, boundary abad 1899 vs 1900 vs 2000, kematian sebelum birthDate dibuang, format salah throw, 2000-02-29 kabisat sah, 1900-02-29 throw (bukan kabisat), hidup dihitung selamat semua titik grid (censored), anniversary boundary belum ulang tahun, grid ASC, urutan input acak hasil identik, pembulatan 2 desimal, kohort kosong nihil di output.

## Gates (mirror v324 sampai v327)
- npm ci
- npx vitest run src/lib/stats/survival-cohort-century.test.ts : minimal 14/14 lulus
- npm run build : rc 0 (prebuild guard pure core)
- npx tsc --noEmit : rc 0
- npx eslint kedua berkas : rc 0
- 0 em dash di seluruh diff
- package.json dan lockfile nihil berubah
- Baseline flaky terdokumentasi: living-stats-hardening.test.ts dan upcoming-birthdays.test.ts dapat fail saat paralel penuh dan lulus terisolasi; BUKAN regresi task ini.

## Proses git (WAJIB)
1. Repo /home/zeroclaw/projects/stemmagraph: git fetch origin, lalu checkout cabang existing improve/stg-v328-survival-cohort-century (JANGAN buat cabang baru).
2. Sinkron: git merge origin/develop bila develop maju, resolve konflik bila ada.
3. Kerjakan 2 berkas BARU sesuai spesifikasi.
4. Komit dini pada menit 5 sampai 10, komit granular, push origin tiap komit.
5. Sebelum selesai: git merge origin/develop sekali lagi, resolve, push.
6. DILARANG MERGE KE DEVELOP SENDIRI. DILARANG menyentuh main atau staging. Lapor akhir: SHA komit, output gates verbatim, nama cabang.
