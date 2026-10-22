# Kontrak GOAL v359-STG-BIRTH-INTERVAL fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-124)

- Konsep: birth interval = jarak antar kelahiran kandung berurutan dalam satu family (sibling-to-sibling spacing), statistik demografi keluarga standar. Pipeline fill terverifikasi buffer wake-86 (20 Okt) dan direview ulang wake-124.
- Anti-dup BERSIH first-hand wake-124: grep birthInterval / birth.interval nihil di src/ server/ origin/develop, nihil di drafts/, tidak ada modul serupa di src/lib/stats/ (30 modul terinventarisasi).
- Beda substansi dari v308 fertility-span (merged): v308 mengukur rentang TOTAL per family (earliest ke latest, spanDays spanMonths) dan butuh minimal 2 anak untuk span nonzero. v359 mengukur DISTRIBUSI jarak pasangan kelahiran BERURUTAN (n-1 interval dari n anak), output histogram interval ber-index bucket bulan. Dua anak dengan jarak sama menghasilkan v308 span identik dengan dua pasang anak berjarak beda; v359 membedah struktur internalnya.
- Basis cabang: origin/develop b7e7e13 (S-04 merged wake-124, origin DAN github identik terverifikasi).

## AC

1. TEPAT 2 berkas BARU: `src/lib/stats/birth-interval.ts` dan `src/lib/stats/birth-interval.test.ts`. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: hanya boleh import type dari ../genealogy/family-graph (pola consanguinity.ts). Tanpa I/O, tanpa Date runtime (parsing manual pola fertility-span.ts boleh Date.UTC untuk serial), tanpa random, deterministik, urutan output mengikuti urutan input family.
3. API modul: `computeBirthIntervals(families: { familyId: string; childBirthDates: string[] }[]): BirthIntervalResult[]`. Output per family: { familyId: string, childCount: number, intervalCount: number, intervalsDays: number[], intervalsMonths: number[] }. intervals terurut asc sesuai urutan kelahiran terurut; childCount < 2 menghasilkan intervalCount 0 dan array kosong TANPA throw.
4. Parsing tanggal strict pola fertility-span.ts: format YYYY-MM-DD saja, bulan 1-12, hari sesuai kalender termasuk kabisat; pelanggaran dilempar Error ber-index prefiks birth-interval. Interval hari = selisih serial UTC dibulatkan (86400000). Interval bulan = whole months pola spanWholeMonths (anniversary reached), minimal 0.
5. Sorting: tanggal per family diurut asc by serial; stabil terhadap tanggal duplikat (interval 0 hari sah, jangan dibuang). Family diurut by familyId localeCompare (pola fertility-span).
6. Helper agregat: `summarizeIntervals(intervalsMonths: number[], bucketSizeMonths = 12): IntervalBucket[]` menghasilkan { bucketStart, bucketEnd (inklusif), count } hanya untuk bucket berisi, terurut asc. bucketSizeMonths bukan integer >= 1: Error ber-index. Argumen berisi non-integer/negatif/string: Error ber-index.
7. Parsing strict struktur input (prefiks birth-interval, pola v349): families bukan array, family bukan objek, familyId bukan string atau kosong, childBirthDates bukan array, elemen bukan string: DILEMPAR Error, bukan difilter diam-diam.
8. Test vitest minimal 14 kasus mencakup: 3 anak jarak 18 dan 24 bulan (2 interval asc); 1 anak dan 0 anak (interval kosong tanpa throw); tanggal duplikat interval 0 hari; tanggal input acak terurut ulang asc; tanggal invalid format throw; 31 Feb throw; 29 Feb kabisat sah; bulan whole-months anniversary (1 Mar ke 1 Mar berikutnya = 12); bulan anniversary belum tercapai (1 Mar ke 28 Feb = 11); summarize bucket 12 dengan bucket 0-11 dan 12-23; summarize bucket size 6; bucketSize 0 dan -1 dan 2.5 throw; intervalsMonths berisi string throw; struktur input salah (bukan array, familyId kosong) throw.
9. Gates: npx vitest run birth-interval (baru semua lulus), npx vitest run src/lib/genealogy (baseline tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, guard pure-core lolos (prebuild), em dash 0 di kedua berkas.
10. Komit granular di cabang `improve/stg-v359-birth-interval`, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.

## Item vision

Stemmagraph pilar statistik keluarga (deret v308-v358, turunan pipeline GOAL statistik demografi), inline VISION-stemmagraph gap demografi keluarga. Tidak menyentuh Zertifico.
