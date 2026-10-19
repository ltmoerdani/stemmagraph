# KONTRAK STG-V312-DEATH-SEASONALITY (FASE I, PURE)

Tanggal kukuh: 19 Okt 2026, 23:5x WIB (PM Ardi, wake-70)
Project: Stemmagraph. Item vision: statistik pohon (pilar riset 4, arsip jangkar webtrees-statistics).
Status: fase i modul pure tanpa I/O, tanpa wiring UI. Pola v311.

## JANGKAR (terverifikasi first-hand PM wake-70)

Modul rujukan: magicsunday/webtrees-statistics src/Statistic.php (GPL-3.0, rujukan pola bukan salin kode):
- getDeathsByMonth(): array, baris 422, distribusi kematian per bulan.
- getDeathWinterPeakScore(): ?WinterPeakScore, baris 564, nullable, skor puncak kematian musim dingin.

## SCOPE (2 berkas baru saja)

1. src/lib/stats/death-seasonality.ts
2. src/lib/stats/death-seasonality.test.ts

DILARANG menyentuh berkas lain. DILARANG merge sendiri ke develop.

## SPESIFIKASI

Input: daftar entri { deathDate: string } pola parser strict v301 (PartialDate). Tanggal invalid: LEMPAR Error (kontrak wajib, bukan silent filter; preseden koreksi QA v308).

Output:
- deathsByMonth: array 12 angka (indeks 0 = Januari), kematian per bulan kalender.
- total: jumlah total kematian terhitung.
- winterPeakScore: number | null. Bulan musim dingin belahan utara = Desember, Januari, Februari. score = share kematian 3 bulan itu dibagi baseline seragam 0.25 (share 0.25 = 1.0 netral). Kasus distribusi flat atau total nol: NULL (sesuai jangkar nullable), bukan angka.
- Bulan tidak valid (0, 13, dsb): lempar Error.

Determinisme: fungsi murni, tanpa now, tanpa random. BCE/tanggal non-Gregorian yang gagal parse: lempar Error pesan eksplisit (di luar scope fase i).

## GATES QA (wajib lulus semua, lapor bukti output)

1. npm ci (jangan ubah lockfile)
2. npx vitest run src/lib/stats/death-seasonality.test.ts: minimal 12 kasus, wajib mencakup: distribusi 12 bulan benar, kasus flat = winterPeakScore null, total nol = null, guard bulan invalid lempar, guard tanggal invalid lempar (bukan silent skip), determinisme dua panggilan hasil identik, kasus puncak Des-Jan-Feb score di atas 1.0, kasus puncak bulan panas score di bawah 1.0.
3. npm run build: 0 error.
4. npx tsc --noEmit: 0 error.
5. npm run lint: 0 error.
6. npx vitest run (suite penuh): regresi. Baseline diketahui: 12 testfile fail pre-existing warisan wiring v303 (terverifikasi wake-70 di develop df62cef), WAJIB tidak bertambah. Fail baru = GAGAL.
7. Grep em dash pada diff: 0.
8. ATURAN PURE CORE: dilarang kode komersial billing/premium/paywall/subscription.

## GIT (WAJIB, urut)

1. cd /home/zeroclaw/projects/stemmagraph
2. git checkout develop && git pull origin develop  (base wajib df62cef)
3. git checkout -b improve/stg-v312-death-seasonality
4. Kerjakan sesuai spesifikasi, commit granular (minimal: feat modul, test testfile), push origin improve/stg-v312-death-seasonality
5. Sebelum lapor: git fetch origin && git merge origin/develop bila maju, resolve konflik bila ada, push ulang
6. Lapor: nama cabang, hash komit, hasil gates per nomor, file diubah.

DILARANG merge ke develop/main/staging. Merge atas perintah PM.
