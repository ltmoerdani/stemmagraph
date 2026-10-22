# Kontrak V355-STG-AGE-AT-DIVORCE-TRIMMED Fase I (modul PURE)

Project: Stemmagraph. Pilar: statistik (pilar 2 VISION-stemmagraph). Tanggal: 2026-10-22.
Cabang kerja: `improve/stg-v355-age-at-divorce` dari origin/develop 6c9aa79. Tipe: ADD-ONLY 2 berkas baru (modul + test) plus kontrak ini di cabang.

## Jangkar

`wt_statistic.php` baris 935 (doc comment 925-934): `getTrimmedAgeAtDivorceDistributions(): array{0: array<string,int>, 1: array<string,int>}` delegasi `DivorceRepository::ageAtDivorceDistribution('M')` dan `('F')` lalu `HistogramTrim::dropCoZeroEnds(...)`. Dokumen jangkar: dua peta band 5 tahun usia saat bercerai (index 0 suami M, index 1 istri F), termasuk bucket overflow 80+, bucket nol di ujung awal dan akhir dibuang simetris (co-trim lintas kedua seri).

## Anti-dup (diverifikasi first-hand PM 22 Okt)

Grep `ageAtDivorce|age-at-divorce|age.?at.?divorce` NIHIL di src/ server/ docs/ GOAL_HISTORY drafts. Beda substantif dari: v325 divorce-widowhood (kohort rate pernikahan plus widowhood interval), v299 age-at-death (umur kematian), v280 marriage-age (usia saat menikah), v347 divorces-by-century (hitungan per abad tanpa usia).

## Spesifikasi modul PURE `src/lib/stats/age-at-divorce.ts`

- Input: `entries: AgeAtDivorceEntry[]` dengan `{ sex: string; birthDate: string | null; divorceDate: string | null }`. Murni transformasi array, tanpa import eksternal, tanpa I/O, tanpa Date.now, deterministik.
- Parser strict pola v308: bentuk entry salah (bukan objek, field tipe salah) LEMPAR `Error` ber-prefiks `age-at-divorce`. Tanggal yang gagal pola EXACT `YYYY-MM-DD` (validasi kalender Gregorian termasuk kabisat, pola living-stats/oldest-living) dibuang per record ke counter, BUKAN throw.
- `divorceDate` sebelum `birthDate` dibuang ke `excludedNegative` (preseden child-mortality).
- `sex` selain `M` dan `F` masuk `excludedOtherSex`, tidak masuk seri.
- Umur: full tahun anniversary-aware dari birthDate ke divorceDate (pola marriage-age). Bucket 5 tahun label `'0-4'`, `'5-9'`, `'10-14'`, ... `'75-79'`, overflow `'80+'`.
- Output: `{ husband: Record<string, number>; wife: Record<string, number>; excludedInvalid: number; excludedNegative: number; excludedOtherSex: number }`. Kedua seri selalu punya set key identik (union bucket tersisa) dan urutan bucket naik.
- Co-trim (semantik HistogramTrim::dropCoZeroEnds): dari ujung awal, selama nilai KEDUA seri bernilai nol pada bucket terdepan, bucket dibuang dari kedua-duanya; lakukan sama dari ujung akhir; bucket nol interior dipertahankan apa adanya. Input kosong atau semua record gugur: kedua seri `{}` tanpa throw.
- Test vitest `age-at-divorce.test.ts` minimal 16 kasus: happy path kedua seri, band 80+ overflow, co-trim awal, co-trim akhir, co-trim dua sisi, interior nol dipertahankan, seri satu sisi nol tidak menghapus bucket (pasangan bukan nol), parser throw prefiks, tanggal invalid dibuang, kabisat, DIV sebelum birth, sex lain, input kosong, determinisme urutan input, urutan key naik, counter eksklusi.

## Gates (mirror v349 sampai v354)

`npm ci`, `npm run build` (vite, tanpa DATABASE_URL), `npm run lint`, `npx tsc --noEmit`, vitest dedikasi lulus penuh, regresi `src/lib/stats` tidak menurunkan baseline, em dash 0 di semua berkas, lockfile dan package.json nihil berubah, guard pure-core lulus. DILARANG merge sendiri ke develop.
