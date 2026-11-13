# Baseline Benchmark Render Canvas v447

Tanggal: 14 Nov 2026. Branch: improve/stg-v447-benchmark-baseline (base develop 6bd33f8). Lingkup: harness + baseline saja, bukan audit.

## Metodologi

Harness: tests/perf/render-harness.ts. Tiap frame dibungkus performance.mark/measure (User Timing) di sekitar render callback. Timestamp frame dari requestAnimationFrame bila ada; environment node tidak punya rAF sehingga fallback performance.now() dan hasilnya dicatat ts=performance.now di log. Frame time yang dilaporkan adalah durasi measure entry, bukan delta antar rAF.

Parameter run:

- Warmup 3 frame per repetisi, tidak dihitung (meredam bias JIT: compile dan inline cache di frame awal proses).
- 100 frame terukur per repetisi, 3 repetisi per ukuran fixture.
- Long task: frame di atas 50 ms (konstanta LONG_TASK_THRESHOLD_MS).
- Heap: sampleHeapMedianBytes menjalankan GC manual bila ada lalu membaca usedJSHeapSize 3 sampel dan mengambil median; fallback performance.measureMemory(); bila keduanya tak ada hasilnya null (heap=n/a).
- Fixture: buildLargeGraph di benchmark-baseline.test.ts memakai buildPerfNode dan buildPerfEdge dari src/components/FamilyTree/__perf__/perf-graph-fixtures.ts (pola buildPerfMember). Struktur: tree bercabang tiga per generasi, edges = nodes - 1.
- Render callback: pass transformasi murni atas data node dan edge (posisi, generasi, parentIds, panjang id source/target). Akumulator ditampung di variabel sink modul dan diasertsi positif pada guard test supaya tidak dioptimasi keluar.

Environment resmi run: node v20.19.6, vitest 4.1.11, environment test node (tanpa DOM), server Blazz.

## Cara Rerun

```sh
cd /home/zeroclaw/projects/stemmagraph
./node_modules/.bin/vitest run --config tests/perf/vitest.perf.config.ts
```

Angka baseline muncul di stdout dengan awalan [v447]. Self-check tsc karya perf: ./node_modules/.bin/tsc -p tests/perf/tsconfig.json --noEmit.

## Angka Baseline (run resmi, 14 Nov 2026, 06:2x UTC+7)

### 2000 node

| Repetisi | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
| --- | --- | --- | --- | --- |
| rep1 | 0.0799 | 0.5750 | 0.6069 | 0 |
| rep2 | 0.0306 | 0.0432 | 0.0670 | 0 |
| rep3 | 0.0329 | 0.0455 | 0.0519 | 0 |

### 5000 node

| Repetisi | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
| --- | --- | --- | --- | --- |
| rep1 | 0.8662 | 0.1355 | 0.7594 | 1 |
| rep2 | 0.0930 | 0.1405 | 0.1586 | 0 |
| rep3 | 0.1057 | 0.1467 | 0.1658 | 0 |

Baseline steady state (median rep2 dan rep3): 2000 node sekitar 0.03 ms avg, p95 0.04 ms, p99 0.06 ms. 5000 node sekitar 0.10 ms avg, p95 0.14 ms, p99 0.16 ms.

## Catatan Variance Antar Run

Tiga run penuh dicatat hari yang sama (dua run eksplorasi 100 frame plus run resmi di atas). Pola konsisten:

1. rep1 selalu lebih lambat dari rep2 dan rep3 (avg bisa 2 sampai 20 kali lipat). Penyebab: proses vitest baru, JIT belum stabil untuk fixture tersebut. Angka rep1 jangan dipakai sebagai baseline.
2. Outlier p99 sporadis: dua run sebelum run resmi mencatat p99 9.57 ms dan 76.76 ms di rep1 dengan long task 1 sampai 2 frame. Ini efek GC V8 di server shared, muncul acak, tidak diulang pada rep2 dan rep3.
3. Skala antar ukuran stabil: 2.5 kali lipat node menghasilkan sekitar 3 kali lipat frame time steady state, mendekati linear.

Rekomendasi pembacaan: pakai median rep2 dan rep3; bandingkan run antar hari hanya pada rep2 dan rep3.

Catatan historis: run awal 40 frame tanpa warmup (sebelum perbaikan metodologi) menghasilkan avg 5.16 ms untuk 2000 node dan 0.17 ms untuk 5000 node dengan p99 hingga 97 ms. Angka ini bias JIT dan tidak lagi relevan; dipertahankan di sini hanya sebagai jejak mengapa warmup dan repetisi ditambahkan.

## Heap (n/a)

Semua run mencatat heap=n/a. Node v20 tanpa flag tidak menyediakan performance.memory maupun performance.measureMemory yang terbaca, dan globalThis.gc tidak ada tanpa --expose-gc. Jalur sampling sudah teruji lewat guard test (null diterima sebagai hasil sah). Pengukuran heap nyata menyusul di runner browser (pola artefak v442) bila diperlukan, karena Chrome menyediakan performance.memory.

## Guard Test

Test vitest di tests/perf/benchmark-baseline.test.ts memverifikasi:

- measureCount sama dengan jumlah frame (entri performance measure benar-benar terbentuk per frame).
- Semua frame time finite dan non-negatif; total frame time positif.
- Guard 15 node 5 frame: long task 0, timestamp source performance.now.
- Kontrak User Timing langsung: satu entri measure terbaca via performance.getEntriesByName lalu dibersihkan.
- Sink akumulasi render positif.
- sampleHeapMedianBytes mengembalikan null atau angka finite positif.

## Batasan

Baseline ini mengukur pass transformasi data murni, yang menjadi biaya dominan siap-render React Flow, tetapi tidak mencakup commit React dan paint DOM. Pengukuran render canvas sesungguhnya (FPS nyata di browser) ada di artefak v442 (Playwright) dan menjadi kelanjutan di luar lingkup v447 baseline.
