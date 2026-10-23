# Kontrak v331-STG-MARRIAGE-DURATION-EXTREMES fase i (kukuh PM wake-93, 21 Okt 2026)

## Jangkar (terverifikasi first-hand PM wake-93, raw GitHub dibaca langsung)
- magicsunday/webtrees-statistics src/Repository/MarriageRepository.php: durationDistribution() baris 210, longestMarriageRecord() baris 229, shortestMarriageRecord() baris 272, getMarriageDurationExtremes(topN=3) baris 319. Konstanta: DURATION_BUCKET 10 (baris 73), DURATION_MAX 60 (baris 75), MAX_PLAUSIBLE_SPOUSE_AGE 90 (baris 120). Sumber: https://raw.githubusercontent.com/magicsunday/webtrees-statistics/main/src/Repository/MarriageRepository.php

## Anti-dup (BERSIH first-hand PM wake-93)
- grep marriageDuration, durationDistribution, longestMarriage, shortestMarriage, duration-extremes NIHIL di src dan server develop. nihil v331 di GOAL_HISTORY dan drafts. Beda substantif dari: v318 couple age gap (selisih usia lahir), v325 widowhood interval (MARR ke wafat), v327 remarriage interval (wafat ke nikah lagi), v329 parental age first child.

## Spec modul pure
- Berkas WAJIB TEPAT 2 BARU add-only: src/lib/stats/marriage-duration.ts dan src/lib/stats/marriage-duration.test.ts. DILARANG menyentuh berkas lain, DILARANG mengubah lockfile.
- Input: list keluarga { familyId, marriageDate, divorceDate, spouse1DeathDate, spouse2DeathDate }. marriageDate WAJIB ada dan EXACT ymd, hilang lempar Error, non-EXACT atau parsial dibuang diam (satu record). Field opsional: non-EXACT atau parsial diperlakukan null. Parser strict pola v308 sampai v330: input bukan array lempar Error, elemen bukan objek lempar Error, familyId hilang atau bukan string lempar Error.
- Resolusi end: kandidat end adalah divorceDate dan dua deathDate spouse yang lebih BESAR dari marriageDate (hari penuh). end = kandidat terkecil. Tidak ada kandidat: record digugur dari distribusi dan extremes (union tanpa event pengakhir tidak terukur). endReason = divorce bila divorceDate adalah kandidat terkecil persis, selain itu death.
- durationYears = integer tahun penuh anniversary end dikurangi marriageDate. durationDays = selisih hari UTC penuh.
- Distribusi: bucket 10 tahun, label n-m naik (0-9, 10-19, sampai 60+), hanya union MARR dengan end, output { buckets: [ { band, count } ] } urut naik, bucket kosong count 0 dipertahankan.
- longestMarriageRecord: years maksimum, years kurang dari sama dengan 0 digugur, years di atas 90 digugur (cap plausibility), tie-break familyId strcmp ASC, output null bila kosong.
- shortestMarriageRecord: satuan HARI (bukan tahun), end sama hari (days 0) digugur, days minimum, tie-break familyId strcmp ASC, output null bila kosong.
- getMarriageDurationExtremes(topN default 3): { shortest: [...], longest: [...] } masing-masing elemen { familyId, years, days, endReason }, cap 90 berlaku kedua kolom, satu familyId TIDAK boleh muncul di dua kolom sekaligus (prioritas longest), urutan shortest naik by days, longest turun by years, tie-break familyId strcmp.
- Output deterministik, murni, tanpa I/O, tanpa Date.now, tanpa random, tanpa em dash.

## Test
- vitest minimal 14 kasus: input kosong, bucket tepi 0 dan 60 dan 61+ (60+), end tepat anniversary, end sebelum MARR diabaikan, DIV bukan kandidat terkecil jadi death, tanpa end digugur, DIV non-EXACT diperlakukan null, tie-break familyId, cap 90 di longest dan extremes, shortest satuan hari, end sama hari digugur, top-N tanpa duplikasi family di dua kolom, throw bukan array, throw elemen bukan objek, throw marriageDate hilang.

## Gates (mirror v324 sampai v330)
- npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, vitest dedikasi lulus penuh, em dash 0 di diff, lockfile nihil berubah, scope tepat 2 berkas BARU.
- DILARANG merge sendiri ke develop. Lapor PM saat push selesai.
