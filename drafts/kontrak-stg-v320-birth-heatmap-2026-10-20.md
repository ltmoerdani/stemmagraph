# KONTRAK v320-STG-BIRTH-HEATMAP FASE I (2026-10-20)

PM: Ardi. Eksekutor: fullstack (Raka). Cabang: improve/stg-v320-birth-heatmap dari origin/develop 691b28f. DILARANG merge sendiri ke develop.

## Jangkar
wt_statistic.php baris 545 getBirthHeatmapByPeriodMonth(): HeatmapPayload delegasi ke LifeSpanRepository::eventHeatmapByPeriodMonth('BIRT'). Semantik: kelahiran faceted per 25-year period x calendar month, heatmap 12 bulan x N periode.

## Anti-dup
Grep heatmap nihil di src/ dan server/ (terverifikasi PM 20 Okt 10:1x). v320 nihil di GOAL_HISTORY dan drafts. Beda substantif dari death-seasonality v312 (agregat bulanan lintas tahun, bukan matriks periode x bulan).

## Scope (tepat 3 berkas)
1. src/lib/stats/birth-heatmap.ts (baru, modul PURE: tanpa import server/, tanpa prisma, tanpa fetch)
2. src/lib/stats/birth-heatmap.test.ts (baru, vitest)
3. drafts/kontrak-stg-v320-birth-heatmap-2026-10-20.md (sudah ada di cabang, jangan diubah)
Lockfile dan package.json DILARANG berubah.

## Spesifikasi perilaku
Input: array BirthDateEntry { yearStart: number | null, monthStart: number | null } (pola PartialDate, mirror couple-age-gap.ts).

Dua lapis pemeriksaan dipisah tegas (pola v308/v318/v319):
- Parser strict LEMPAR Error dengan nama field dan indeks elemen untuk bentuk payload salah (bukan array, elemen bukan objek, tipe field bukan number/null). DILARANG silent-filter di level parser.
- Nilai di luar domain adalah data invalid sah: yearStart null, monthStart null, monthStart di luar [1,12], yearStart <= 0 (guard BCE). Di-skip dari matriks dan dihitung invalidDates.

Periode: indeks periode = floor(yearStart / 25) * 25 (bucket 25 tahun rata ke 0). Label = "<start>-<start+24>" contoh 1950-1974. Hanya periode berisi minimal 1 kelahiran valid yang masuk output, urut ascending by start.

Output BirthHeatmapPayload:
- months: tuple tetap [1..12]
- periods: array { start: number, label: string } ascending
- matrix: number[][] dengan matrix[i][m-1] = hitungan kelahiran periode i bulan m (baris sejajar periods, kolom 12 selalu)
- validDates: number, invalidDates: number

Semantik output: input kosong atau semua invalid tetap mengembalikan { months: [1..12], periods: [], matrix: [], validDates: 0, invalidDates: N } tanpa throw.

## Test (mirror v319, target 16 sampai 18 kasus)
Boundary: tahun 1949 (periode 1925-1949), 1950 (1950-1974); bulan 1 dan 12 masuk; bulan 0 dan 13 invalid; yearStart null, monthStart null, yearStart 0 dan negatif invalid; parser throw untuk elemen bukan objek dan tipe salah dengan nama field di pesan; determinisme dua run identik; input kosong; periode tunggal vs multi periode ascending; hitungan agregat benar untuk kasus campur.

## Gates (wajib lulus semua)
1. npx vitest run src/lib/stats/birth-heatmap.test.ts : semua lulus
2. npm run build : rc 0
3. npx tsc --noEmit : rc 0
4. npx eslint src/lib/stats/birth-heatmap.ts src/lib/stats/birth-heatmap.test.ts : rc 0
5. em dash (U+2014) : 0 di kedua berkas baru
6. git diff vs develop : tepat 3 berkas, lockfile nihil

Baseline diketahui: 12 testfile fail warisan wiring v303 saat regresi paralel, wajib tidak bertambah. Komet dini menit 5 sampai 10. Push ke origin cabang eksplisit. Lapor: nama cabang, hash komit, output gates.
