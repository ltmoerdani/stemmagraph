# Kontrak v316-STG-SEX-RATIO-ANOMALIES FASE I (modul pure + test)

Tanggal: 2026-10-20. Penyusun: PM Ardi (derivasi mandiri dari VISION Stemmagraph, fallback first-hand, pipeline fill buffer pasca COMPACT wake-74 item 8).

## Jangkar (terverifikasi first-hand PM, wt_statistic.php baris 304)

- getSexRatioAnomalies(int $minChildren = 6, float $skewThreshold = 0.80, int $limit = 10): array, mendelegasikan ke familyRepository->getSexRatioAnomalies($minChildren, $skewThreshold, $limit).
- Doc comment jangkar: families whose recorded children are heavily skewed toward one sex.
- Parameter: minChildren = jumlah minimum anak bersex (sexed) yang harus dimiliki family; skewThreshold = share minimum (0..1) yang harus dicapai sex dominan; limit = jumlah maksimum family yang dikembalikan.
- Item VISION: differensiator data Stemmagraph (statistik genealogis pure, tanpa komersial).

## Anti-dup (diverifikasi PM 20 Okt, wake-75)

- grep sexratio, sex-ratio di src/ dan server/ NIHIL.
- v316, sex ratio NIHIL di GOAL_HISTORY.md dan drafts/.
- Modul lain (v313 surname-marriage-matrix, v314 mortality-anomalies, v315 sibling-death-clusters) beda substantif: agregat kematian/perkawinan, bukan komposisi sex anak per family.
- Kesimpulan: BERSIH, boleh disiapkan. Dispatch SERIAL pasca verdict v314 (anti double-dispatch, preseden v313).

## Scope (2 berkas BARU saja, plus kontrak ini)

1. src/lib/stats/sex-ratio-anomalies.ts (modul pure, tanpa I/O, tanpa import komersial).
2. src/lib/stats/sex-ratio-anomalies.test.ts (vitest, 12 sampai 14 kasus).

DILARANG menyentuh berkas lain. DILARANG mengubah lockfile. DILARANG merge sendiri ke develop.

## Spesifikasi perilaku (keputusan desain PM, preseden modul pure v307 sampai v315)

Input: array families { children: Array<{ sex: 'M' | 'F' | string | null }> }. Child tanpa sex yang valid (null, selain M/F case-insensitive) diabaikan dari hitungan sexed. Family tetap masuk array input, penanganan ada di logika hitung.

Proses:
1. Untuk tiap family, hitung jumlah anak sexed (sex M atau F, case-insensitive). Family lolos syarat kandidat hanya jika jumlah sexed >= minChildren (default 6).
2. Untuk family kandidat, hitung jumlah M dan jumlah F. Sex dominan = yang lebih banyak. Dominan share = max(M,F) / total sexed.
3. Family jadi anomali hanya jika dominan share >= skewThreshold (default 0.80).
4. Urutkan anomali: dominan share menurun, tie-break jumlah sexed menurun, tie-break stabilitas urutan input (indeks menaik).
5. Potong hasil menjadi maksimal limit (default 10) entri.
6. Jika input kosong atau tidak ada family lolos, hasil array kosong, JANGAN throw.
7. Output per entri: { maleCount: number; femaleCount: number; sexedCount: number; dominantShare: number } tanpa identitas family (modul pure tanpa data pribadi).

Parameter fungsi: computeSexRatioAnomalies(families, options?) dengan options.minChildren default 6, options.skewThreshold default 0.80, options.limit default 10.

## Gates (mirror v312 v313 v314 v315)

- vitest dedikasi modul lulus penuh.
- npm run build rc 0.
- tsc rc 0.
- eslint rc 0 pada berkas baru.
- Em dash nihil di semua berkas baru.
- Lockfile tidak berubah.
- Baseline 12 testfile fail warisan v303 tidak bertambah.

## Parser strict

sex selain M/F (termasuk kosong, angka, string lain) diabaikan per record tanpa menggagalkan batch (preseden parser strict v315: field opsional tidak valid diabaikan per record, Error hanya untuk field wajib yang jelas rusak; di sini sex bersifat opsional jadi cukup diabaikan).
