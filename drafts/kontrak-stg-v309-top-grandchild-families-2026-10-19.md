# KONTRAK v309-STG-TOP-GRANDCHILD-FAMILIES FASE I (19 Okt 2026, PM Ardi)

Item: statistik ranking keluarga berdasar jumlah CUCU (dua langkah turun).
Sumber: draft Sena wake-64 tervalidasi PM, jangkar magicsunday/webtrees-statistics FamilyRankingRepository::topGrandchildFamilies (COUNT cucu group by f_id, order count DESC tie f_id ASC; komentar core webtrees N+1 GH-115).

## SCOPE: TEPAT 2 berkas BARU, add-only
1. `src/lib/stats/top-grandchild-families.ts` modul pure:
   - `export interface GrandchildFamilyInput { familyId: string; grandchildIds: string[] }`
   - `export interface RankedGrandchildFamily { familyId: string; grandchildCount: number }`
   - `export function topGrandchildFamilies(families: GrandchildFamilyInput[], topN = 10): RankedGrandchildFamily[]`
   - Dedup WAJIB di dalam modul: Set per keluarga atas grandchildIds (cucu lewat dua anak atau posisi dua-ortu dihitung SEKALI).
   - count = ukuran Set; keluarga count 0 TIDAK masuk output.
   - Urut grandchildCount DESC, tie familyId ASC, lalu slice(0, topN) stabil.
   - topN <= 0 hasil kosong array. Input kosong hasil kosong. Deterministik penuh.
   - BEDA dari v300 (anak langsung) dan v304 (anak per orang): metrik dua langkah turun.
2. `src/lib/stats/top-grandchild-families.test.ts` min 12 kasus eksplisit:
   ranking dasar lintas 2 generasi; tie-break familyId asc; dedup cucu lewat 2 anak (link ganda); dedup posisi dua-ortu; anak tanpa FAMS kontribusi nol (daftar kosong tidak masuk); semua kosong hasil kosong; topN memotong stabil; topN 0 dan negatif kosong; topN 1; count 0 keluarga tak masuk; urutan stabil antar slice; kasus pembeda vs v300 (keluarga anak banyak tapi cucu sedikit kalah dari keluarga cucu banyak).

## LARANGAN
Tanpa menyentuh: family-graph.ts, modul stats existing (top-largest-families, most-children-per-person, children-per-family, dkk), storage, schema, server, adapter UI, StatsSidebar, i18n, lockfile. Wiring fase ii route + fase iii StatsSidebar menyusul pasca fase i merged. DILARANG merge sendiri ke develop.

## GATES (mirror v298 v304)
npm ci; build rc 0 (npm run build) SEBELUM vitest; dedikasi 12/12; regresi src/lib/genealogy + src/lib/stats nihil fail substantif (rerun serial bila flaky beban, pola preseden); tsc rc 0; eslint delta rc 0; em dash 0; scope TEPAT 2 berkas baru. Komit dini menit 5-10, push tiap berkas, jalur heredoc bila file_write gagal senyap.

## ALUR
cabang `improve/stg-v309-top-grandchild-families` dari origin/develop 71d1758 (sudah disiapkan PM, kontrak ikut di cabang). Dispatch SERIAL pasca verdict v307 atau salvase, anti bentrok working tree eksekutor sama. QA R1 PM pasca push stabil atau ambang salvase 75 menit.
