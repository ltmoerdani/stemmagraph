# KONTRAK V344-STG-SIBLING-AGE-GAP FASE I (2026-10-21)

Project: Stemmagraph. Cabang: improve/stg-v344-sibling-age-gap dari origin/develop 35f92c4. PM Ardi wake-111.

## 1. Jangkar

wt_statistic.php baris 976 sampai 985: getSiblingAgeGapDistribution(): array delegasi childrenRepository->siblingAgeGapDistribution(). Doc comment jangkar resmi: Distribution of gaps (years) between consecutive siblings. Terverifikasi first-hand PM wake-111 (sed baris 970 sampai 1000 di repo referensi).

## 2. Anti-dup

git grep siblingAgeGap / sibling-age-gap NIHIL di origin/develop src dan server (first-hand 21 Okt). git log --all -- '*sibling-age-gap*' NIHIL commit pernah ada (pelajaran insiden v342 wake-110 diterapkan penuh: cek git log --all path dulu). Satu-satunya modul sibling* existing adalah sibling-death-clusters (v315, beda substansi: mortalitas per tahun, bukan gap kelahiran). Penyebutan di kontrak v324 hanyalah catatan belum-ada-modul, bukan modul. BOARD dan GOAL_HISTORY nihil v344.

## 3. Interface (modul src/lib/stats/sibling-age-gap.ts)

export interface SiblingAgeGapSibling { id: string; birthDate: string }
export interface SiblingAgeGapFamily { familyId: string; children: SiblingAgeGapSibling[] }
export interface SiblingAgeGapResult { gapsByYears: Record<string, number>; totalPairs: number; familiesCounted: number; maxGap: number | null }
export function computeSiblingAgeGap(families: unknown, options?: { maxGapCap?: number }): SiblingAgeGapResult

## 4. Semantik dan parser strict

- DEFINISI GAP: untuk tiap keluarga, urutkan anak ber-dated birthDate ascending, gap dihitung antara PASANGAN KONSEKUTIF saja (sibling ke-i dan ke-i+1), gap dalam TAHUN penuh = selisih tahun kalender tanggal lahir (komponen year), bukan selisih hari. Alasan: jangkar menyebut gaps (years) antara consecutive siblings.
- families harus array; tiap entri objek { familyId: string; children: array }; tiap anak objek { id: string; birthDate: string }; pelanggaran throw Error pesan diawali 'sibling-age-gap' dan menyebut index keluarga atau anak.
- birthDate format wajib YYYY-MM-DD (pola v339): selain itu throw ber-index; bulan 1 sampai 12, hari valid kalender termasuk 29 Feb kabisat, 29 Feb non-kabisat throw.
- Keluarga dengan anak dated kurang dari 2: di-skip untuk perhitungan gap TAPI tidak error (jangkar hanya menghitung gap, keluarga 1 anak nihil gap).
- Keluarga dengan familyId duplikat: SEMUA kemunculan tetap dihitung (jangkar repo tidak dedupe), TAPI familiesCounted menghitung keluarga unik yang menyumbang minimal satu pasangan.
- gapsByYears: kunci string tahun gap '1', '2', '3' dst (tahun >= 1 karena urut ascending dan tanggal unik per anak tidak diasumsikan; gap 0 untuk kembar tahun sama MASUK kunci '0').
- options.maxGapCap integer >= 1 default 30: gap di atas cap tetap masuk totalPairs TAPI bucket-nya digabung ke kunci `>=${maxGapCap}` (kunci literal seperti '>=30'). invalid cap throw prefiks sama. Cap menjaga output bounded mirror semangat histogram jangkar.
- totalPairs: jumlah semua pasangan konsekutif terhitung lintas keluarga. maxGap: gap terbesar terhitung, null saat nihil pasangan (pola nullable jangkar).
- Deterministik: urutan input families tidak memengaruhi output (akumulasi di map); nihil randomness, nihil jam sistem.

## 5. Test vitest (src/lib/stats/sibling-age-gap.test.ts)

Minimum 15 kasus, wajib mencakup: dasar satu keluarga 3 anak gap konsekutif; gap 0 kembar tahun sama masuk kunci '0'; multi keluarga terakumulasi; anak undated nihil (input tanpa undated di scope ini karena birthDate wajib string valid, jadi kasusnya keluarga 1 anak di-skip); keluarga kosong dan children kosong; urutan input families acak hasil identik; maxGapCap custom penggabungan kunci '>=N'; maxGapCap default 30; maxGapCap invalid throw; input bukan array throw; entri keluarga bukan objek throw; familyId bukan string throw; children bukan array throw; anak bukan objek throw; id bukan string throw; birthDate bukan string throw; format salah throw; bulan 00 dan 13 throw; 29 Feb kabisat valid dan non-kabisat throw; prefiks pesan via regex /sibling-age-gap/; totalPairs tepat; familiesCounted unik tepat; maxGap tepat dan null saat kosong.

## 6. Gate QA (identik v341 v343)

npm ci rc 0; npx vitest run file test semua pass; npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo); em dash 0; lockfile nihil berubah; scope TEPAT 2 berkas baru plus kontrak.

## 7. Batas

DILARANG merge ke develop/main/staging sendiri. Dilarang sentuh main atau staging. Pure core tanpa kode komersial. Branch kerja: improve/stg-v344-sibling-age-gap.
