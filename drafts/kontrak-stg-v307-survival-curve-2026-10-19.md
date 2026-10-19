# KONTRAK v307-STG-SURVIVAL-CURVE FASE I (rekonstruksi PM wake-69, 19 Okt 2026)

Item: deret demografi Stemmagraph, kurva kelangsungan hidup kohort kelahiran. Jangkar magicsunday/webtrees-statistics tab Life span (tervalidasi PM wake-64 wake-65: README tab Life span terpetakan penuh). Kontrak asli hilang senyap bersama dispatch wake-63 (pola tercatat BOARD wake-67), direkonstruksi PM dari riwayat BOARD dan jangkar riset, substansi tidak berubah.

## SCOPE: TEPAT 2 berkas BARU, add-only

1. `src/lib/stats/survival-curve.ts` modul pure tanpa I/O:
   - `export interface SurvivalMember { birthDate: string; deathDate: string | null }` (deathDate null = hidup, pola v267 isAlive)
   - `export interface SurvivalCohortResult { decade: string; cohortSize: number; survivorsAtAges: Array<{ age: number; aliveCount: number; survivalFraction: number }> }`
   - `export function computeSurvivalCurve(members: SurvivalMember[], opts?: { cohortDecade?: boolean }): SurvivalCohortResult[]`, default kelompok kohort per DEKADE kelahiran (kunci 1970s pola v311)
   - Parser strict YYYY-MM-DD pola v301: tanggal tak valid atau format salah DILEMPAR Error; deathDate sebelum birthDate DIBUANG (pola v310).
   - Umur seseorang pada tanda umur A = whole years anniversary-aware pola v301 (belum ulang tahun tahun itu tidak naik); meninggal sebelum A = tidak selamat; hidup atau meninggal pada/sesudah umur A = selamat pada A.
   - Grid umur 0 sampai 100 step 10 (11 titik); survivalFraction = aliveCount / cohortSize 2 desimal; anggota hidup dihitung selamat di semua titik (censored right, catatan jujur metodologi di komentar).
   - Kohort size 0 tidak masuk output; decades urut kronologis ASC; grid umur ASC; deterministik penuh, urutan input tidak memengaruhi hasil.
2. `src/lib/stats/survival-curve.test.ts` vitest min 12 kasus eksplisit:
   input kosong; satu kohort dasar; kohort per dekade terpisah benar; meninggal muda tidak selamat umur tinggi; hidup dianggap selamat semua titik (censored); boundary ulang tahun tepat umur A; deathDate sebelum birthDate dibuang; tanggal tak valid dilempar; format salah dilempar; survivalFraction umur 0 = 1 dan monoton tidak naik; dua pemanggilan identik (determinisme); kohort tunggal anggota 1 fraction 1 atau 0.

## LARANGAN
Tanpa menyentuh: modul stats existing (oldest-living, living-stats, age-at-death, child-mortality, fertility-span, dkk), family-graph, schema, server, adapter UI, StatsSidebar, i18n, lockfile. Wiring fase ii route dan fase iii UI menyusul pasca fase i merged. DILARANG merge sendiri ke develop. DILARANG commit main atau staging. 0 em dash di diff.

## GATES (mirror v301 v304 v310)
npm ci; npm run build rc 0 SEBELUM vitest; dedikasi min 12/12 hijau; regresi npx vitest run src/lib/genealogy hijau baseline 2106; npx tsc --noEmit rc 0; npx eslint 2 berkas delta rc 0; scope TEPAT 2 berkas baru plus kontrak. Komit dini menit 5 sampai 10, push tiap komit.

## EKSEKUSI
Cabang improve/stg-v307-survival-curve, base origin/develop b43caba (disiapkan PM), komit kontrak sudah di cabang.
