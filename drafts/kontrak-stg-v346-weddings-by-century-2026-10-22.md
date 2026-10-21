# KONTRAK V346-STG-WEDDINGS-BY-CENTURY FASE I (2026-10-22)

Project: Stemmagraph. Cabang: improve/stg-v346-weddings-by-century dari origin/develop 16c3ec5. PM Ardi wake-112.

## 1. Jangkar

Deret statistik webtrees: distribusi pernikahan per abad (keluarga analisis pernikahan per periode abad kelahiran bukan). Terverifikasi posisi antre PM wake-112 dari inventaris jangkar sisa wake-110 (endogamy, occupation-inheritance, missing-event-gaps, weddings-by-century, divorces-by-century, migration-flows), weddings-by-century diambil pertama sebagai event-series per century paling sederhana simetris dengan modul century-existing.

## 2. Anti-dup

git grep weddings-by-century / weddingsByCentury / wedding NIHIL modul stats di origin/develop src dan server (first-hand 22 Okt; satu-satunya wedding di stats adalah upcoming-anniversaries beda substansi: pengingat hari jadi dan anniversary mendatang, bukan distribusi per abad). git log --all -- '*wedding*' nihil commit modul stats (pelajaran insiden v342 diterapkan penuh). avg-lifespan-sex-century dan survival-cohort-century beda substansi (umur, bukan pernikahan). GOAL_HISTORY nihil v346.

## 3. Interface (modul src/lib/stats/weddings-by-century.ts)

export interface WeddingRecord { familyId: string; marriageDate: string | null }
export interface WeddingsByCenturyResult { centuries: { century: string; count: number }[]; total: number; undated: number }
export function computeWeddingsByCentury(records: unknown): WeddingsByCenturyResult

Input records: array entri SATU per keluarga (familyId string, marriageDate YYYY-MM-DD atau null bila keluarga nihil tanggal pernikahan terverifikasi). century dihitung dari DEKADE pernikahan, floor(year/100)*100, label string '1500', '1600' dst pola survival-cohort-century (centuryStart string).

## 4. Semantik dan parser strict

- records harus array; tiap entri objek { familyId: string; marriageDate: string | null }; pelanggaran throw Error pesan diawali 'weddings-by-century' dan menyebut index entri.
- familyId wajib string non-kosong, selain itu throw ber-index.
- marriageDate null SAH: masuk penghitung undated (mirror pola dated-only jangkar yang membuang entri tanpa tanggal), TIDAK throw.
- marriageDate string wajib format YYYY-MM-DD pola v339/v344: bulan 1 sampai 12, hari valid kalender termasuk 29 Feb kabisat, 29 Feb non-kabisat throw, semua throw ber-index.
- marriageDate tipe lain (number, objek, array): throw.
- familyId duplikat lintas entri: SEMUA entri tetap dihitung (jangkar tidak dedupe keluarga), konsisten v344.
- centuries: array berurut ASC berdasarkan centuryStart numerik; hanya abad dengan count >= 1 yang muncul (kohort nihil tidak masuk output pola v328); count integer >= 1.
- label century = String(centuryStart): '1500', '1600', dst.
- total = jumlah count semua abad; undated = jumlah marriageDate null.
- Deterministik: akumulasi di map, urutan input tidak memengaruhi isi output KECUALI tidak ada karena output diurut ASC numerik; nihil randomness, nihil jam sistem, tanpa I/O.

## 5. Test vitest (src/lib/stats/weddings-by-century.test.ts)

Minimum 15 kasus, wajib mencakup: dasar satu abad; multi abad urut ASC numerik (input acak hasil tetap ASC); abad tanpa pernikahan tidak muncul; null masuk undated bukan throw; total tepat; undated tepat; familyId duplikat dihitung semua; label String(centuryStart); keluarga dengan marriageDate di tahun 2000 masuk abad 2000 (floor 2000/100*100 = 2000); tahun 1999 masuk 1900; input kosong: centuries kosong total 0 undated 0; urutan input acak hasil identik; input bukan array throw; entri bukan objek throw; familyId bukan string throw; familyId string kosong throw; marriageDate tipe salah throw; format salah throw; bulan 00 dan 13 throw; 29 Feb kabisat valid dan non-kabisat throw; prefiks pesan via regex /weddings-by-century/.

## 6. Gate QA (identik v341 v343 v344 v345)

npm ci rc 0; npx vitest run file test semua pass; npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo); em dash 0; lockfile nihil berubah; scope TEPAT 2 berkas baru plus kontrak.

## 7. Batas

DILARANG merge ke develop/main/staging sendiri. Dilarang sentuh main atau staging. Pure core tanpa kode komersial. Branch kerja: improve/stg-v346-weddings-by-century.
