# KONTRAK STG-V313-SURNAME-MARRIAGE-MATRIX (FASE I, PURE)

Tanggal kukuh: 20 Okt 2026, 00:1x WIB (PM Ardi, wake-71)
Project: Stemmagraph. Item vision: statistik pohon (pilar riset 4, arsip jangkar webtrees-statistics).
Status: fase i modul pure tanpa I/O, tanpa wiring UI. Pola v312/v311.

## JANGKAR (terverifikasi first-hand PM wake-71)

Modul rujukan: magicsunday/webtrees-statistics src/Statistic.php (GPL-3.0, rujukan pola bukan salin kode):
- getSurnameMarriageMatrix(int $topN = 8): ChordMatrixPayload, baris 156, matriks simetris surname x surname untuk chord diagram tab Names.
- Kontrak jangkar: Top-N surname per jumlah perkawinan; matriks simetris sehingga [i][j] === [j][i] untuk setiap sel off-diagonal.
- Repository pendukung: MarriageMatrixRepository::surnameMarriageMatrix.

## SCOPE (2 berkas baru saja)

1. src/lib/stats/surname-marriage-matrix.ts
2. src/lib/stats/surname-marriage-matrix.test.ts

DILARANG menyentuh berkas lain. DILARANG merge sendiri ke develop.

## SPESIFIKASI

- Input abstrak: daftar pasangan { husbandSurname, wifeSurname } bertipe string | null. Pemetaan dari FamilyRelationship plus surname member adalah urusan fase ii; modul pure menerima array pasangan surname saja.
- Pasangan dengan salah satu sisi null, empty, atau whitespace-only masuk skippedMissing dan tidak masuk matriks.
- Pasangan dengan surname sama (case-insensitive) tetap dihitung pada sel diagonal [i][i], konsisten matriks simetris.
- Normalisasi surname: trim. Kunci dedup lowercase; label node memakai bentuk kemunculan pertama (fold varian ejaan pola v311).
- Seleksi node: topN surname berdasar total keterlibatan (kemunculan sebagai sisi husband atau wife), count DESC, tie key ASC alfabetis.
- Output: { nodes: string[], matrix: number[][], pairs: Array<{ a: string, b: string, count: number }>, skippedMissing: number, totalPairs: number }. pairs terurut count DESC tie key ASC.
- matrix[i][j] = jumlah pasangan antara node i dan node j; simetris; diagonal termasuk.
- Null guard: array input kosong mengembalikan null (pola v267).
- Deterministik: nihil randomness, nihil jam sistem di jalur data, agregasi urutan-tidak-sensitif.
- Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan, nihil dependency baru. Add-only.

## TEST (vitest, dedikasi, minimal 12 kasus)

1. Array kosong mengembalikan null.
2. Satu pasangan beda surname: 2 node, matriks 2x2 simetris, count 1.
3. Pasangan surname sama: satu node, diagonal bertambah.
4. Varian kapital (Anshari vs anshari): satu node, label pertama menang.
5. Whitespace di trim.
6. skippedMissing menghitung null, empty, dan whitespace-only.
7. topN memotong node terlemah keluar matriks.
8. Tie count: urutan alfabetis key ASC.
9. Simetri [i][j] sama [j][i] pada beberapa sel.
10. pairs terurut count DESC.
11. totalPairs dan skippedMissing akurat.
12. Determinisme: urutan input diacak menghasilkan output identik.

## GATES (mirror v311/v312)

- npm ci, lockfile tidak berubah (cek porcelain sebelum dan sesudah).
- npm run build exit 0 (build dulu sebelum vitest, pola mirror v298/v304/v309).
- npx vitest run src/lib/stats/surname-marriage-matrix.test.ts, semua lulus.
- npx tsc --noEmit exit 0.
- npm run lint exit 0.
- Grep em dash nihil di kedua berkas scope.
- Baseline 12 testfile fail warisan wiring v303 di develop wajib tidak bertambah.
- Komit granular, push cabang, DILARANG merge sendiri ke develop.

## BRANCH

improve/stg-v313-surname-marriage-matrix, dibuat dari origin/develop df62cef.
