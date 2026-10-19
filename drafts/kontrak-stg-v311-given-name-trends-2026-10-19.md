# KONTRAK v311-STG-GIVEN-NAME-TRENDS FASE I (19 Okt 2026, PM Ardi, BUFFER)

> Deret demografi Stemmagraph, jangkar magicsunday/webtrees-statistics GivenNameTrendsRepository::countByDecade (akses improver 19 Okt raw.githubusercontent). Tren nama depan per dekade kelahiran. ANTI-DUP PM BERSIH 19 Okt: nihil given-name-trends varian di src dan server, v311 nihil di GOAL_HISTORY.

## SCOPE: TEPAT 2 berkas BARU, add-only

1. src/lib/stats/given-name-trends.ts modul pure tanpa I/O:
   - export interface NameTrendMember { birthDate: string, givenName: string }
   - export interface NameDecadeCell { name: string, decade: string, count: number }
   - export interface NameTrendsResult { names: string[], decades: string[], series: Array<{ name: string, countsByDecade: Record<string, number> }>, totalNames: number }
   - export function computeGivenNameTrends(members: NameTrendMember[], opts?: { topN?: number }): NameTrendsResult, default topN 10 rentang 1 sampai 50
   - Ekstraksi token nama depan: split spasi, token pertama; normalisasi fold case (lowercase) plus tanda baca dihapus (titik koma dsb); guard token @P.N. dan placeholder kosong dibuang; dedup token per orang (orang dengan nama ganda sama dihitung sekali).
   - Dekade dari birthDate strict YYYY-MM-DD (parser pola v301, error tanggal tak valid dilempar): kunci 1970s dst = floor(tahun/10)*10.
   - Hitung count per pasangan nama plus dekade; names urut total count DESC tie alfabetis ASC ambil topN; decades urut kronologis ASC; series hanya berisi names terpilih dengan countsByDecade lengkap semua decades (nol eksplisit 0).
   - Deterministik penuh, urutan input tidak memengaruhi hasil.
2. src/lib/stats/given-name-trends.test.ts vitest min 12 kasus eksplisit:
   input kosong; satu nama satu dekade; fold case MERI meri Meri satu; tanda baca dibersihkan; guard P.N. placeholder dibuang; dedup token per orang; dua dekade terpisah urut; topN memotong; topN 0 dan negatif dan di atas 50 ditangani (clamp atau error konsisten satu aturan); countsByDecade nol eksplisit; tanggal tak valid ditolak; determinisme dua pemanggilan; tie alfabetis.

## LARANGAN
Tanpa menyentuh: modul stats existing, family-graph, schema, server, adapter UI, StatsSidebar, i18n, lockfile. Wiring fase ii route plus fase iii UI menyusul pasca fase i merged. DILARANG merge sendiri ke develop. DILARANG commit main atau staging. 0 em dash di diff.

## GATES (mirror v301 v304)
npm ci; npm run build rc 0 SEBELUM vitest; dedikasi 12/12 hijau; regresi npx vitest run src/lib/genealogy hijau baseline 2106 (rerun serial bila flaky beban); npx tsc --noEmit rc 0; npx eslint 2 berkas delta rc 0; scope TEPAT 2 berkas baru plus kontrak. Komit dini menit 5 sampai 10, push tiap komit.

## EKSEKUSI
Cabang improve/stg-v311-given-name-trends dari origin/develop (disiapkan PM pasca kukuh final). DISPATCH SERIAL pasca verdict item antrean di depannya, anti bentrok working tree eksekutor sama.
