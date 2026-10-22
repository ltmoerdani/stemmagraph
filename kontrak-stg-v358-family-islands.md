# Kontrak GOAL v358-STG-FAMILY-ISLANDS fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-120)

- Jangkar konsep: connected components atas graph parentage (pulau keluarga), pola statistik pohon modul magicsunday/webtrees-statistics yang sudah menjadi jangkar seri v349 sampai v357. Tidak ada modul eksplisit FamilyIslands di repo jangkar (inventaris Calc diverifikasi PM 22 Okt 2026 via GitHub API): ini derivasi PM mandiri dari metode graph-statistics yang sama, preseden derivasi v356 PartnershipChains dan v357 GenerationDepth.
- Semantik: pulau = connected component pada graph TAK BERARAH dari edges parentage (childId-parentId). Dua node terhubung bila terhubung langsung atau transitif lewat edges parentage apa pun arah. Contoh: kakek-parent-anak-cucu satu pulau meski arah edge konsisten anak-ke-ortu.
- Anti-dup BERSIH first-hand: grep family-island dan familyIsland nihil di src/. Berbeda substantif dari partnership-reach.ts v356 (graph pernikahan pasangan, metrik hub degree dan diameter) dan dari consanguinity.ts (darah satu leluhur): modul ini graph parentage, output ukuran dan jumlah pulau.
- Basis cabang: origin/develop 09a6647 (v357 merged wake-120, origin DAN github identik terverifikasi ls-remote).

## AC

1. TEPAT 2 berkas BARU: src/lib/stats/family-islands.ts dan src/lib/stats/family-islands.test.ts. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import apa pun, tanpa I/O, tanpa Date, tanpa random, deterministik.
3. API modul: computeFamilyIslands(edges: ParentageEdge[]) dengan export interface ParentageEdge { childId: string; parentId: string }.
4. Output FamilyIslandsResult { islandCount: number; largestIslandSize: number; distribution: Array<{ size: number; count: number }>; nodeCount: number }. islandCount = jumlah pulau (graph nihil node = 0 dengan distribution array kosong); largestIslandSize = ukuran pulau terbesar (0 bila nihil); distribution = histogram ukuran pulau URUT size ascending, tanpa entri bercount 0; nodeCount = semua node unik dari edges.
5. Edge duplikat didedupe sebelum analisis (pola v282 dan v357). Node hanya muncul dari edges: setiap node minimal satu edge sehingga ukuran pulau minimal 2.
6. Parsing strict ber-index prefiks family-islands (pola v349 sampai v357): edges bukan array, entri bukan objek, childId atau parentId bukan string atau string kosong: DILEMPAR Error ber-index. Tidak ada options pada goal ini.
7. Deterministik: traversal BFS mulai dari node id terkecil tak terkunjungi, tetangga diurutkan id ascending; urutan input edges tidak mengubah hasil apa pun.
8. Test vitest minimal 16 kasus mencakup: edges kosong (islandCount 0, distribution kosong, largest 0); satu pulau dua node; satu pulau rantai 4 node; dua pulau terpisah; rantai konektivitas transitif 5 node satu pulau; diamond parentage; node bersama dua ortu menyatukan pulau (ayah dan ibu dari anak sama, dua keluarga asal jadi satu pulau); edge duplikat dedupe; edge berlawanan arah dianggap sama (child-parent vs parent-child dedupe sebagai satu edge tak berarah); urutan input acak deterministik; childId kosong throw; parentId kosong throw; entri bukan objek throw; edges bukan array throw; pulau ukuran 3 dan ukuran 2 distribution benar; kasus besar 200 node satu rantai satu pulau nodeCount 200.
9. Gates: npx vitest run src/lib/stats/family-islands.test.ts lulus semua; npx vitest run src/lib/genealogy tidak regressed; npm run build rc 0; npx tsc --noEmit rc 0; npx eslint kedua berkas rc 0; 0 em dash di diff.
10. Komit granular di cabang improve/stg-v358-family-islands, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main dan staging, QA R1 oleh PM pasca push stabil.

## Sumber

- https://github.com/magicsunday/webtrees-statistics (inventaris Calc diverifikasi 22 Okt 2026)
- https://raw.githubusercontent.com/magicsunday/webtrees-statistics/main/src/Repository/PartnershipChainsRepository.php (pola konsumsi statistik graph per komponen)
