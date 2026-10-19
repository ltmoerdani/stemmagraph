# KONTRAK v310-STG-CHILD-MORTALITY-U5 FASE I (19 Okt 2026, PM Ardi)

> Deret demografi Stemmagraph, jangkar magicsunday/webtrees-statistics ChildMortalityRepository.php (akses improver 19 Okt, raw.githubusercontent). ANTI-DUP PM BERSIH 19 Okt: nihil childmortality varian di src dan server, v310 nihil di GOAL_HISTORY. KOREKSI AC dari jangkar: ambang 1826 hari (5 x 365.25 floor), input pasangan BIRT plus DEAT saja, deathDate sebelum birthDate dibuang, kohort per ABAD kelahiran, bucket total di bawah 5 dibuang (MIN_COHORT_SIZE), rate persen 1 desimal plus fraksi 4 desimal sbg field kedua, rate adalah lower bound (caveat UI fase iii).

## SCOPE: TEPAT 2 berkas BARU, add-only

1. src/lib/stats/child-mortality.ts modul pure tanpa I/O:
   - export interface ChildMortalityMember { birthDate: string, deathDate: string | null, isAlive: boolean }
   - export interface ChildMortalityCohort { cohort: string, cohortSize: number, deathsUnder5: number, ratePercent: number, rateFraction: number }
   - export interface ChildMortalityResult { totalSampled: number, totalDeathsUnder5: number, overallRatePercent: number, overallRateFraction: number, cohorts: ChildMortalityCohort[] }
   - export function computeChildMortality(members: ChildMortalityMember[]): ChildMortalityResult
   - Sampel = member deceased dengan birthDate DAN deathDate terparse strict YYYY-MM-DD (pola parser v301, error tanggal tak valid di-lempar). isAlive tidak dipakai sbg filter jangkar tapi tetap di interface utk keseragaman pola; living otomatis keluar sampel.
   - deathDate sebelum birthDate: member dibuang dari sampel (jangkar).
   - Kematian di bawah ambang 1826 hari umur (floor Julian day, kabisat aman) = deathsUnder5.
   - Kohort per abad kelahiran (kunci 1900s 1990s dst), urut kronologis ASC; bucket total sampel kohort di bawah 5 TIDAK masuk output (MIN_COHORT_SIZE 5).
   - rateFraction = deathsUnder5 / cohortSize 4 desimal round half up; ratePercent = 1 desimal. overall pakai seluruh sampel.
   - Deterministik penuh, urutan input tidak memengaruhi hasil.
2. src/lib/stats/child-mortality.test.ts vitest min 12 kasus eksplisit:
   input kosong; satu kematian bayi; kematian tepat ambang 1826 hari (masuk) vs 1827 hari (keluar); kabisat 29 Feb ambang; living keluar sampel; deceased tanpa deathDate keluar sampel; deathDate sebelum birthDate dibuang; tanggal tak valid ditolak; kohort abad terpisah urut; kohort di bawah 5 sampel dibuang; rateFraction 4 desimal kasus 2/8 dan 1/3; determinisme dua pemanggilan; overall vs kohort konsisten.

## LARANGAN
Tanpa menyentuh: modul stats existing (age-at-death, survival-curve, living-stats, dkk), family-graph, schema, server, adapter UI, StatsSidebar, i18n, lockfile. Wiring fase ii route plus fase iii StatsSidebar (dengan caveat lower bound di copy UI) menyusul pasca fase i merged. DILARANG merge sendiri ke develop. DILARANG commit main atau staging. 0 em dash di diff.

## GATES (mirror v301 v304)
npm ci; npm run build rc 0 SEBELUM vitest; dedikasi 12/12 hijau; regresi npx vitest run src/lib/genealogy hijau baseline 2106 (rerun serial bila flaky beban); npx tsc --noEmit rc 0; npx eslint 2 berkas delta rc 0; scope TEPAT 2 berkas baru plus kontrak. Komit dini menit 5 sampai 10, push tiap komit.

## EKSEKUSI
Cabang improve/stg-v310-child-mortality-u5 dari origin/develop 71d1758 (disiapkan PM). DISPATCH SERIAL pasca verdict item antrean di depannya, anti bentrok working tree eksekutor sama.
