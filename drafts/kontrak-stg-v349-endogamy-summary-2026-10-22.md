# Kontrak GOAL v349-STG-ENDOGAMY-SUMMARY fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-113)

- Jangkar: `getEndogamySummary(): ?EndogamyRate` di wt_statistic.php baris 743, delegasi `EndogamyRepository::summary()`. Doc comment jangkar: endogamy summary = testable-couple count, count sharing >= 1 common ancestor within the default depth, resulting percentage, and the depth used. Null bila nihil testable couple (pohon tanpa parentage links).
- Komentar jangkar baris 113: cousin-marriage / shared-ancestor rate within FOUR generations (Family tab).
- Anti-dup BERSIH first-hand: grep endogam nihil di src/ dan server/ origin/develop 5bf5477, git log --all -- '*endogamy*' nihil, GOAL_HISTORY dan drafts nihil v349.
- Beda substansi dari v326 consanguinity (merged): v326 menghitung jarak generasi minimum k antara dua spouse SATU union lewat common ancestor, output degreeCounts k. v349 menghitung RINGKASAN AGREGAT lintas union dengan KEDALAMAN MAKSIMAL 4 generasi (default depth jangkar), output testable/shared/proportion/depth, TANPA rincian degree. Perbandingan < k maxDepth, bukan persamaan k.
- Basis cabang: origin/develop 5bf5477 (v348 merged wake-112, origin DAN github identik terverifikasi ls-remote).

## AC

1. TEPAT 2 berkas BARU: `src/lib/stats/endogamy-summary.ts` dan `src/lib/stats/endogamy-summary.test.ts`. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import apa pun (mirror pola consanguinity.ts yang import type FamilyGraph, boleh import type dari ../genealogy/family-graph). Tanpa I/O, tanpa Date, tanpa random, deterministik, urutan output mengikuti urutan input.
3. API modul: `analyzeEndogamy(graph: FamilyGraph, options?: { maxDepth?: number })`. Default maxDepth = 4 (jangkar four generations). maxDepth bukan integer >= 1: Error ber-index.
4. Union testable: union dengan TEPAT 2 spouse id berbeda (keduanya muncul di graph.personIds, id tidak dikenal di personIds tetap dihitung sebagai spouse sah, pola v326 tidak mensyaratkan keanggotaan personIds) dan KEDUA spouse punya jejak parentage di graph (muncul sebagai child di parentEdges ATAU punya ortu terjangkau). Union bukan testable: tidak masuk evaluated, tidak throw.
5. Shared ancestor: himpunan leluhur termasuk diri tiap spouse (BFS naik via parentEdges, dist diri = 0, visited per akar pola v326), hitung pasangan (a, b) common ancestor c dengan dist(a,c) + dist(b,c) <= maxDepth. Union shared bila ADA minimal satu pasangan memenuhi.
6. Output `EndogamySummaryResult`: { testable: number, shared: number, proportionPct: number, maxDepth: number }. proportionPct = 100 * shared / testable round 1 desimal (pola v325/v326); testable = 0 -> proportionPct = 0. Graph kosong / tanpa union: hasil nol TANPA throw (jangkar null-safe, pola v326).
7. Parsing strict ber-index pola v344/v346 (prefiks endogamy-summary): graph bukan objek, personIds/unions/parentEdges bukan array, union bukan objek, spouses bukan array, spouse id bukan string, spouse id string kosong, parentEdge bukan objek, child bukan string, parents bukan array atau elemen bukan string: DILEMPAR Error ber-index, bukan difilter diam-diam.
8. Test vitest minimal 16 kasus mencakup: graph kosong; union tanpa 2 spouse; union 2 spouse tanpa parentage (tidak testable); sepupu pertama k=2 pasangan dist 1+1 lewat kakek (shared dalam depth 4); sepupu jarak total 6 > 4 (tidak shared); saudara k=2 pasangan 1+1 (shared); maxDepth eksplisit 2 meniadakan pasangan jarak 3; maxDepth 0 dan -1 dan 1.5 dan '4' throw; union urutan input; proportionPct round 1 desimal; testable 0 -> pct 0; parentEdges siklus aman; child edge dengan parents ganda dedup BFS; union dengan spouse sama id (dilewati); struktur salah tiap bentuk throw.
9. Gates: npx vitest run endogamy-summary (baru semua lulus), npx vitest run src/lib/genealogy (baseline tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint src/lib/stats/endogamy-summary.ts src/lib/stats/endogamy-summary.test.ts rc 0, em dash 0 di kedua berkas.
10. Komit granular di cabang `improve/stg-v349-endogamy-summary`, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.
