# Kontrak GOAL v357-STG-DESCENDANT-DEPTH fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-120)

- Jangkar: `src/Support/Calc/GenerationDepth.php` modul magicsunday/webtrees-statistics (di-fetch penuh PM 22 Okt 2026). Semantik: depth individu = jumlah generasi KETURUNAN tercatat di bawahnya, leaf 0, orang tua dari anak 1, dst; histogram per individu atas SEMUA node yang muncul di parentage graph (sebagai parent atau child); tree-wide maxDepth; longest-path memoisation sehingga pedigree collapse ambil jalur TERPANJANG; cap MAX_DEPTH = 100, node yang menyentuh cap ditandai capped (sinyal kualitas data: siklus atau rantai tak wajar).
- Determinisme jangkar: walk DFS per node dengan on-path set anti infinite loop; depth(node) = 1 + max(depth(anak)); node clamp di 100 bila melewati cap; depth === MAX_DEPTH dihitung capped (termasuk rantai sah tepat menyentuh cap).
- Anti-dup BERSIH first-hand: grep descendant-depth/descendantDepth/brick-wall nihil modul stats; `descendantDepth` di src/lib/genealogy/kinship-calc.ts baris 100 adalah kedalaman relasi DUA orang spesifik (kinship), bukan statistik tree-wide; generations.ts v282 menghitung depth ke ATAS (leluhur), arah keturunan belum ada.
- Basis cabang: origin/develop ad6f603 (v356 merged wake-119, origin DAN github identik terverifikasi ls-remote).
- Anomali tercatat: cabang lokal `improve/stg-v357-family-islands` muncul tanpa dispatch PM, tip == ad6f603 nihil komit unik, nihil di origin, TIDAK dikonsumsi, dipertahankan sebagai bukti audit (pola preseden W1563/v172).

## AC

1. TEPAT 2 berkas BARU: `src/lib/stats/descendant-depth.ts` dan `src/lib/stats/descendant-depth.test.ts`. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import apa pun. Tanpa I/O, Date, random; deterministik.
3. API modul: `computeDescendantDepth(edges: DescendantEdge[], options?: { maxDepth?: number })` dengan `export interface DescendantEdge { childId: string; parentId: string }`. Default maxDepth = 100. Node set = semua childId dan parentId unik; edge duplikat didedupe sebelum analisis (pola v282).
4. Semantik: depth leaf (node nihil anak dalam node set) = 0; depth(node) = 1 + maksimum depth semua anaknya (multi-child ambil maks). Semua node masuk histogram, termasuk node yang hanya muncul sebagai parent.
5. Cap: bila depth suatu node mencapai maxDepth (default 100), node di-clamp ke maxDepth dan flag capped = true (setia jangkar: depth === cap dihitung capped, termasuk rantai sah yang tepat menyentuh cap). Walk dilindungi on-path set sehingga siklus berhingga, node pada siklus berujung clamp dan capped true.
6. Output `DescendantDepthResult { maxDepth: number; distribution: Array<{ depth: number; count: number }>; capped: boolean; nodeCount: number }`. distribution urut depth ascending mulai 0 sampai maxDepth, SELALU minimal satu entri (setia jangkar array_fill: graph nihil node tetap entri depth 0 bercount 0). maxDepth hasil = maksimum depth cache semua node.
7. Parsing strict ber-index pola v349-v351 (prefiks descendant-depth): edges bukan array, entri bukan objek, childId/parentId bukan string atau string kosong, options.maxDepth ada tapi bukan integer >= 1: DILEMPAR Error ber-index.
8. Deterministik: proses node id ascending, anak diurutkan id ascending, urutan input edges tidak mengubah hasil.
9. Test vitest minimal 16 kasus mencakup: edges kosong (distribution tunggal depth 0 count 0, capped false); satu pasangan parent-child (depth 1 dan 0); rantai 3 generasi; rantai 4 generasi maxDepth 3; pedigree collapse dua jalur beda panjang ambil terpanjang; diamond dua jalur sama panjang; multi-child ambil maks; node hanya parent tanpa parent sendiri masuk histogram; edge duplikat dedupe; siklus dua node clamp capped true; siklus tiga node; rantai sah 101 node menyentuh cap capped true maxDepth 100; rantai 150 node clamp di cap; maxDepth opsi kustom (mis. 3) mengubah titik clamp; edges kosong + maxDepth 0 throw; childId kosong throw; entri bukan objek throw; determinisme urutan input acak.
10. Gates: npx vitest run descendant-depth (lulus semua), npx vitest run src/lib/genealogy (tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0.
11. Komit granular di cabang `improve/stg-v357-descendant-depth`, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.

## Sumber

- https://raw.githubusercontent.com/magicsunday/webtrees-statistics/main/src/Support/Calc/GenerationDepth.php (diakses 22 Okt 2026)
- https://raw.githubusercontent.com/magicsunday/webtrees-statistics/main/src/Repository/GenerationDepthRepository.php (diakses 22 Okt 2026, konsumen: histogram per individu tab Family, brick-wall surfacing)
- README modul: https://github.com/magicsunday/webtrees-statistics
