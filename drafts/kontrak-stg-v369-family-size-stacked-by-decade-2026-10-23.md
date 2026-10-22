# KONTRAK STG-V369-FAMILY-SIZE-STACKED-BY-DECADE (FASE I, PURE)

Tanggal kukuh: 23 Okt 2026, 02:4x WIB (PM Ardi, wake-130)
Project: Stemmagraph. Item vision: statistik pohon (pilar riset 4, arsip jangkar webtrees-statistics).
Status: fase i modul pure tanpa I/O, tanpa wiring UI.
Catatan anti-dup: nihil family-size-stacked / stacked-by-decade / FamilySizeStacked di develop (git grep first-hand wake-130). family-size-stats.ts v287 = distribusi agregat seluruh pohon, beda fungsi dari pivot dekade ini.

## JANGKAR (terverifikasi first-hand PM wake-130)

Modul rujukan: magicsunday/webtrees-statistics wt_statistic.php baris 987:
- getFamilySizeStackedByDecade(): StackedBarPayload, satu bar per dekade (1900s, 1910s, dst), segmen stack 1/2/3/4+ anak. Repository: childrenRepository::familySizeStackedByDecade.
- Rujukan pola, bukan salinan kode.

## SCOPE (2 berkas baru saja)

1. src/lib/stats/family-size-stacked-by-decade.ts
2. src/lib/stats/family-size-stacked-by-decade.test.ts

DILARANG menyentuh berkas lain. DILARANG merge sendiri ke develop.

## SPESIFIKASI

- Nama fungsi: computeFamilySizeStackedByDecade(entries).
- Input abstrak: array entri { referenceYear: number, childIds: string[] }. referenceYear = tahun acuan keluarga (mis. tahun pernikahan orang tua) dari lapisan data atas; childIds = daftar id anak (GEDCOM 7 term CHIL, pola v287).
- Parser strict pola v367 (throw ber-index ber-prefiks family-size-stacked-by-decade:): input bukan array, entri bukan objek, referenceYear bukan integer berhingga, childIds bukan array of string = THROW, bukan difilter diam-diam.
- Dekade = floor(referenceYear / 10) * 10, sama pola v352/v367.
- Segmen per bar sesuai jangkar: one = 1 anak, two = 2, three = 3, fourPlus = >= 4. Keluarga 0 anak TIDAK masuk segmen stack; dihitung terpisah sebagai childless per bar (adaptasi konsisten bucket zero v287, terdokumentasi).
- Output: { bars: Array<{ decade: number, one: number, two: number, three: number, fourPlus: number, childless: number, total: number }> }. total = one+two+three+fourPlus+childless. Bars terurut decade ASC.
- Leading dan trailing dekade kosong DIPANGKAS; dekade kosong di TENGAH dipertahankan dengan semua segmen 0 (pola v352). Input kosong menghasilkan bars kosong tanpa throw.
- Deterministik: nihil randomness, nihil Date/jam sistem di jalur data, agregasi per kunci dekade sebelum pembentukan series sehingga urutan input tak memengaruhi output.
- Tanpa import apa pun, tanpa I/O, tanpa fetch, nihil dependency baru. Add-only. PURE CORE: dilarang kode komersial apa pun.

## TEST (vitest, dedikasi, minimal 14 kasus)

1. Input kosong menghasilkan bars kosong tanpa throw.
2. Satu dekade satu keluarga 2 anak: bar { two: 1, total: 1 }.
3. Multi dekade terurut ASC meski input acak.
4. Segmen fourPlus: keluarga 4, 6, 9 anak semua masuk fourPlus.
5. Keluarga 0 anak masuk childless, tidak masuk stack.
6. total = jumlah kelima segmen.
7. Dekade kosong tengah dipertahankan semua segmen 0.
8. Dekade kosong leading dan trailing dipangkas.
9. Boundary dekade: tahun 1900 dan 1909 sama-sama dekade 1900; 1910 masuk 1910.
10. Tahun negatif dan tahun kecil (mis. 45): floor menghasilkan dekade benar (40, 0) tanpa throw.
11. Throw: input bukan array.
12. Throw: entri bukan objek, referenceYear bukan integer (1952.5, NaN, string), childIds bukan array.
13. Determinisme: dua urutan input berbeda menghasilkan bars identik.
14. Beberapa keluarga dalam satu dekade terakumulasi per segmen.

## GIT (WAJIB)

1. git checkout develop && git pull origin develop di /home/zeroclaw/projects/stemmagraph
2. Buat branch improve/stg-v369-family-size-stacked DARI develop
3. Kerjakan sesuai AC, commit granular, PUSH per komit ke origin
4. Sebelum selesai: git merge develop ke branch, resolve konflik, push
5. Lapor: repo, nama branch, file diubah, hasil verifikasi lokal
