# KONTRAK V298 STG MOST INFLUENTIAL ANCESTORS FASE I (PURE)

Tanggal: 2026-10-19. Penulis: PM Ardi. Status: KUKUH.
Sumber: VISION-stemmagraph pilar 2 statistik, buffer draft Sena wake-50 (jangkar getTopAncestorsByDescendantCount di webtrees Statistic.php, descendant count transitif DAG, Lacy 1989 pedigree completeness sbg jangkar sekunder).

## SCOPE: TEPAT 2 BERKAS BARU

1. `src/lib/stats/most-influential-ancestors.ts`: fungsi pure `mostInfluentialAncestors(graph: FamilyGraph, topN = 10)`. Tanpa import apa pun kecuali tipe FamilyGraph dari src/lib/genealogy/family-graph.ts (import tipe saja).
2. `src/lib/stats/most-influential-ancestors.test.ts`: testfile dedikasi min 12 kasus.

## SEMANTIK

- Input FamilyGraph dari buildFamilyGraph (v171): personIds, unions, parentEdges.
- Ancestor kandidat: setiap orang yang muncul di parents[] minimal satu parentEdge.
- Descendant count transitif: BFS dari kandidat menurun lewat parentEdges (parent -> child), visited set GLOBAL first-touch anti pedigree collapse, hitung orang unik.
- Output array urut descendantCount DESC, tie-break personId ASC, maks topN entri.
- Orang tanpa descendant (0) DIKECUALIKAN dari hasil.
- topN <= 0 mengembalikan array kosong.
- Deterministik penuh: hasil sama untuk input sama.
- default topN = 10.

## TEST MIN 12 KASUS (eksplisit)

1. single ancestor single child hitung 1
2. rantai 3 generasi ancestor puncak hitung semua turunan transitif
3. pasangan dengan anak bersama keduanya kandidat count sama
4. pedigree collapse kakek duplikat lewat 2 jalur dihitung 1 kali per orang
5. tie-break personId asc
6. urutan desc count benar
7. topN memotong hasil
8. topN 0 dan negatif array kosong
9. graph tanpa edge parent hasil kosong
10. orang tanpa anak dikecualikan
11. remarriage anak dari 2 union tetap dihitung sekali (dedup)
12. determinisme: dua kali panggilan hasil identik

## LARANGAN

Tidak menyentuh: family-graph.ts, modul stats lain, schema, storage, server, adapter, StatsSidebar, i18n, lockfile. DILARANG merge sendiri. DILARANG wiring fase lanjutan.

## GATES (urutan wajib, mirror v299 v300)

1. Guard pure core 0 hit.
2. npm run build rc 0 SEBELUM vitest.
3. Vitest dedikasi min 12/12 lulus.
4. Regresi folder src/lib/genealogy nihil gagal (baseline 2106).
5. npx tsc --noEmit rc 0.
6. ESLint kedua berkas rc 0, em dash 0 di seluruh delta.
7. git push origin cabang, lapor SHA.
