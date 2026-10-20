# KONTRAK v321-STG-DEATH-HEATMAP FASE I (2026-10-20)

PM: Ardi. Eksekutor: fullstack (Raka). Cabang: improve/stg-v321-death-heatmap dari origin/develop 54dd711. DILARANG merge sendiri ke develop (pelanggaran proses v318-v320 dicatat dan ditegas: eksekutor TIDAK merge, lapor dan tunggu PM).

## Jangkar
wt_statistic.php baris 555 getDeathHeatmapByPeriodMonth(): HeatmapPayload delegasi ke LifeSpanRepository::eventHeatmapByPeriodMonth('DEAT'). Semantik: kematian faceted per 25-year period x calendar month, heatmap 12 bulan x N periode, simetris v320 birth heatmap (merged 54dd711).

## Anti-dup
Grep death-heatmap dan heatmap (di luar birth-heatmap) nihil di src/ server/ GOAL_HISTORY drafts (terverifikasi PM 20 Okt 12:1x). v321 nihil di GOAL_HISTORY. Beda dari v312 death-seasonality (agregat bulanan lintas tahun, bukan matriks periode x bulan) dan dari v320 (BIRT vs DEAT).

## Scope (tepat 3 berkas)
1. src/lib/stats/death-heatmap.ts (baru, modul PURE: tanpa import server/, tanpa prisma, tanpa fetch)
2. src/lib/stats/death-heatmap.test.ts (baru, vitest)
3. drafts/kontrak-stg-v321-death-heatmap-2026-10-20.md (sudah ada di cabang, jangan diubah)
Lockfile dan package.json DILARANG berubah.

## Spesifikasi perilaku (mirror penuh v320, domain DEAT)
Input: array DeathDateEntry { yearStart: number | null, monthStart: number | null } (pola PartialDate, mirror birth-heatmap.ts).

Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v319/v320):
- Parser strict LEMPAR Error dengan nama field dan indeks elemen untuk bentuk payload salah (bukan array, elemen bukan objek, tipe field bukan number/null). DILARANG silent-filter di level parser.
- Nilai di luar domain adalah data invalid sah: yearStart null, monthStart null, monthStart di luar [1,12], yearStart <= 0 (guard BCE). Di-skip dari matriks dan dihitung invalidDates.

Periode: indeks periode = floor(yearStart / 25) * 25 (bucket 25 tahun rata ke 0). Label = "<start>-<start+24>" contoh 1950-1974. Hanya periode berisi minimal 1 kematian valid yang masuk output, urut ascending by start.

Output DeathHeatmapPayload:
- months: tuple tetap [1..12]
- periods: array { start: number, label: string } ascending
- matrix: number[][] dengan matrix[i][m-1] = hitungan kematian periode i bulan m (baris sejajar periods, kolom 12 selalu)
- validDeaths: number, invalidDeaths: number

Semantik output: input kosong atau semua invalid tetap mengembalikan { months: [1..12], periods: [], matrix: [], validDeaths: 0, invalidDeaths: N } tanpa throw.

## Test (mirror v320, target 16 sampai 18 kasus)
Boundary: tahun 1949 (periode 1925-1949), 1950 (1950-1974); bulan 1 dan 12 masuk; bulan 0 dan 13 invalid; yearStart null, monthStart null, yearStart 0 dan negatif invalid; parser throw untuk elemen bukan objek dan tipe salah dengan nama field di pesan; determinisme dua run identik; input kosong; periode tunggal vs multi periode ascending; hitungan agregat benar untuk kasus campur.

## Gates (wajib lulus semua)
1. npx vitest run src/lib/stats/death-heatmap.test.ts : semua lulus
2. npm run build : rc 0
3. npx tsc --noEmit : rc 0
4. npx eslint src/lib/stats/death-heatmap.ts src/lib/stats/death-heatmap.test.ts : rc 0
5. em dash (U+2014) : 0 di kedua berkas baru
6. git diff vs develop : tepat 3 berkas, lockfile nihil

Baseline diketahui: regresi paralel penuh 5 testfile fail warisan (lulus serial rerun), wajib tidak bertambah. Komit dini menit 5 sampai 10. Push ke origin cabang eksplisit. Lapor: nama cabang, hash komit, output gates.
