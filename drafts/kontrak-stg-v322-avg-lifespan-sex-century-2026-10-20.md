# KONTRAK v322-STG-AVG-LIFESPAN-SEX-CENTURY FASE I (2026-10-20)

PM: Ardi. Eksekutor: fullstack (Raka). Cabang: improve/stg-v322-avg-lifespan-sex-century dari origin/develop 9419863. DILARANG merge sendiri ke develop (pelanggaran proses v318-v320 dicatat: eksekutor TIDAK merge, komit dan push ke cabang task saja, lapor dan tunggu PM).

## Jangkar
wt_statistic.php baris 473 getAverageLifespanBySexAndCentury(): LineChartPayload, guard minimum sampel 10 (inventaris improver wake-70 dan wake-81, terverifikasi first-hand). Semantik: rerata umur saat kematian per jenis kelamin per kohort abad kelahiran.

## Anti-dup
Grep lifespan di src/lib/stats/ dan server/ (PM first-hand 20 Okt 13:1x): modul hidup hanya living-stats (orang hidup, bukan umur kematian), dependency-ratio, mortality-anomalies (z-score anomali, bukan rerata), birth-heatmap death-heatmap (matriks bulan). v299 age-at-death.ts distribusi band dekade TANPA split sex dan TANPA kohort abad, beda substantif. v322 nihil di GOAL_HISTORY drafts dan src. BERSIH.

## Scope (tepat 3 berkas)
1. src/lib/stats/avg-lifespan-sex-century.ts (baru, modul PURE: tanpa import server/, tanpa prisma, tanpa fetch)
2. src/lib/stats/avg-lifespan-sex-century.test.ts (baru, vitest)
3. drafts/kontrak-stg-v322-avg-lifespan-sex-century-2026-10-20.md (sudah ada di cabang, jangan diubah)
Lockfile dan package.json DILARANG berubah.

## Spesifikasi perilaku
Input: array LifespanEntry { sex: 'M' | 'F' | 'U' | null, birthYear: number | null, deathYear: number | null }.

Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v319/v320/v321):
- Parser strict parseLifespanEntries LEMPAR Error dengan nama field dan indeks elemen untuk bentuk payload salah (bukan array, elemen bukan objek, sex di luar enum M F U null, birthYear atau deathYear bukan number/null). DILARANG silent-filter di level parser.
- Data invalid sah dihitung counter, bukan throw: birthYear null, deathYear null, birthYear <= 0 (guard BCE), deathYear < birthYear (umur negatif), deathYear == birthYear dihitung valid umur 0.

Filter kohort: sex 'U' atau null di-skip dari sel dan dihitung excludedUnknown. Umur = deathYear - birthYear (integer tahun sederhana, tanpa koreksi anniversary). Abad kohort dari TAHUN LAHIR: bucket = floor(birthYear / 100) * 100, label "<start>-<start+99>" contoh 1800-1899.

Guard: MIN_SAMPLES = 10 (export const). Sel abad x sex dengan sampleSize < 10 mengembalikan null, bukan rerata.

Output AvgLifespanPayload:
- sexes: tuple tetap ['F', 'M']
- centuries: array { start: number, label: string } ascending by start, hanya abad berisi minimal 1 sampel valid
- matrix: (number | null)[][] baris sejajar centuries, kolom index 0 = F, 1 = M; nilai = rerata umur round 1 desimal, null bila sampel di bawah guard
- sampleSizes: number[][] bentuk sama, hitungan sampel per sel
- validLifespans: number, invalidLifespans: number, excludedUnknown: number

Semantik output: input kosong atau semua invalid tetap mengembalikan payload utuh { sexes: ['F','M'], centuries: [], matrix: [], sampleSizes: [], validLifespans: 0, invalidLifespans: N, excludedUnknown: N } tanpa throw.

Deterministik: centuries urut ascending by start, urutan input tidak mengubah output.

## Test (target 16 sampai 20 kasus)
Boundary abad: 1899 (abad 1800-1899), 1900 (abad 1900-1999), 1800; guard: sel 9 sampel null, sel 10 sampel rerata; rerata round 1 desimal; sex M F masuk kolom benar; sex U dan null masuk excludedUnknown; umur negatif invalid; birthYear 0 dan negatif invalid; birthYear atau deathYear null invalid; parser throw bukan array, elemen bukan objek, sex 'X', tipe number salah, dengan nama field dan indeks di pesan; umur 0 valid; multi abad ascending; determinisme dua run urutan acak identik; input kosong payload utuh.

## Gates (wajib lulus semua)
1. npx vitest run src/lib/stats/avg-lifespan-sex-century.test.ts : semua lulus
2. npm run build : rc 0
3. npx tsc --noEmit : rc 0
4. npx eslint src/lib/stats/avg-lifespan-sex-century.ts src/lib/stats/avg-lifespan-sex-century.test.ts : rc 0
5. em dash (U+2014) : 0 di kedua berkas baru
6. git diff vs develop : tepat 3 berkas, lockfile nihil

Baseline diketahui: regresi paralel penuh 5 testfile fail warisan (lulus serial rerun), wajib tidak bertambah. Komit dini menit 5 sampai 10. Push ke origin cabang eksplisit. Lapor: nama cabang, hash komit, output gates.
