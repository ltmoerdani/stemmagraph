# Kontrak v314-STG-MORTALITY-ANOMALIES FASE I (modul pure + test)

Tanggal: 2026-10-20. Penyusun: PM Ardi (derivasi mandiri dari VISION Stemmagraph, fallback first-hand pasca improver sync timeout ketiga beruntun).

## Jangkar (terverifikasi first-hand PM)

- wt_statistic.php baris 579: getMortalityAnomalies(float $zScoreThreshold = 2.0, int $topN = 10): array, mendelegasikan ke lifeSpanRepository->mortalityAnomalies($zScoreThreshold, $topN).
- Doc comment jangkar: tahun dengan jumlah kematian yang menyimpang dari baseline sekitarnya, sidik jari statistik tahun epidemi, perang, atau kelaparan, diranking standard score menurun.
- Item VISION: differensiator data Stemmagraph (statistik genealogis pure, tanpa komersial).

## Anti-dup (diverifikasi PM 20 Okt)

- grep mortalit di src/ server/ hanya menyentuh child-mortality.ts (modul U5, beda substantif: mortalitas anak di bawah 5 tahun per kohort abad, bukan anomali tahunan z-score).
- grep zscore|z-score|zScore NIHIL di src/ dan server/.
- anomal di generation-length.ts hanyalah komentar, bukan modul.
- v314|mortality-anomal NIHIL di GOAL_HISTORY.md.
- Kesimpulan: BERSIH, boleh dispatch.

## Scope (2 berkas BARU saja, plus kontrak ini)

1. src/lib/stats/mortality-anomalies.ts (modul pure, tanpa I/O, tanpa import komersial).
2. src/lib/stats/mortality-anomalies.test.ts (vitest, 12 sampai 14 kasus).

DILARANG menyentuh berkas lain. DILARANG mengubah lockfile. DILARANG merge sendiri ke develop.

## Spesifikasi perilaku (keputusan desain PM, preseden modul pure v307 sampai v313)

Input: array persons { deathDate: string | null } (ISO date atau null, pola input v267/v310). Person tanpa deathDate diabaikan.

Proses:
1. Hitung kematian per tahun kalender dari tahun deathDate.
2. Rentang baseline: semua tahun dari min tahun sampai max tahun kematian (zero-filled, tahun tanpa kematian tetap masuk dengan count 0).
3. mean = rata-rata count atas seluruh rentang; stdev = simpangan baku POPULASI (pembagi N, bukan N-1) atas rentang yang sama.
4. zScore per tahun = (count - mean) / stdev; jika stdev === 0 (atau rentang kosong) hasil array kosong, JANGAN NaN, JANGAN throw.
5. Filter zScore >= zScoreThreshold (default 2.0).
6. Urutan: zScore menurun; tie-break year menaik.
7. Potong topN (default 10).

Output per entri: { year: number; deaths: number; mean: number; stdev: number; zScore: number } dengan mean 2 desimal, stdev 2 desimal, zScore 2 desimal (Math.round x100 / 100, konsisten satu cara).

## Ketahanan input (parser strict, pola koreksi QA v308 yang WAJIB)

- deathDate bukan string dan bukan null: LEMPAR Error (bukan silent-filter).
- deathDate string tapi gagal parse sebagai tanggal valid: LEMPAR Error.
- deathDate dengan tahun di luar 1 sampai 9999: LEMPAR Error.
- Array kosong: kembalikan array kosong (bukan throw).

## Gate (wajib semua lulus sebelum lapor)

1. npm ci tanpa mengubah package-lock.json (verifikasi git status --porcelain package.json package-lock.json kosong).
2. npx vitest run src/lib/stats/mortality-anomalies.test.ts lulus semua kasus.
3. Baseline regresi: 12 testfile fail warisan wiring v303 TIDAK BOLEH bertambah (hitung total fail suite, bandingkan).
4. npm run build exit 0.
5. npx tsc --noEmit exit 0.
6. npx eslint src/lib/stats/mortality-anomalies.ts src/lib/stats/mortality-anomalies.test.ts nihil temuan.
7. Em dash 0 di seluruh berkas baru (cek karakter U+2014).
8. Komit granular dengan pesan jelas, push ke cabang.

## Git (WAJIB urut)

1. git checkout develop && git pull origin develop di repo /home/zeroclaw/projects/stemmagraph (harus 4824fd9 atau lebih baru).
2. Buat cabang improve/stg-v314-mortality-anomalies DARI develop.
3. Kerjakan sesuai scope dan spesifikasi di atas.
4. Commit granular + push origin cabang tersebut.
5. Sebelum lapor: git merge develop ke cabang (resolve jika perlu), push ulang.
6. Lapor: repo, berkas diubah, hasil semua gate (angka nyata), nama cabang.

DILARANG merge ke develop (merge hanya atas perintah PM pasca QA). DILARANG menyentuh main dan staging.
