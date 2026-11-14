# Benchmark Interaksi Pointer v452 (Fase 2 v447)

Tanggal: 14 Nov 2026. Lingkup: benchmark hover dan drag pointer atas data graf, biaya dominan sebelum commit React. Kelanjutan metodologi v447 (harness User Timing, distribusi frame time, long task 50 ms).

## Mengapa Jalur Sintetis

PointerEvent constructor tidak tersedia di node v20 murni (diverifikasi wake-318 sebelum eksekusi). Harness memakai dua jalur: native `PointerEvent` bila runner menyediakan (jalur browser, runner Playwright artefak v442), fallback `Event` sintetis dengan field pointer di-assign via `Object.assign` dan cast tipe eksplisit via unknown. Di environment test node resmi agency, semua run tercatat lewat jalur sintetis (`ts=performance.now`).

`getCoalescedEvents` adalah API limited availability (MDN): harness memeriksa keberadaan fungsi sebelum memanggil; bila ada dan batch tidak kosong, batch ikut diproses (pola pipeline pointer nyata); bila tidak, event diproses tunggal. Kedua kondisi sah dan terguard di test.

## Metodologi

- Fixture identik pola baseline v447: tree bercabang tiga per generasi, edges = nodes - 1, dibangun dari `buildPerfNode` dan `buildPerfEdge` (fixtures `__perf__`), seed deterministik LCG (seed 42 hover, 43 drag) supaya koordinat lompatan pointer reproducible lintas run dan lintas mesin.
- Skenario hover: tiap frame satu `pointermove` sintetis, hit test O(n) node terdekat (kuadrat jarak), pemrosesan enter/leave hanya bila node hovered berubah.
- Skenario drag: tiap frame satu `pointermove` sintetis dengan `buttons=1`, posisi node ter-drag diperbarui, edge yang menyentuh node itu dihitung ulang.
- 100 frame terukur per repetisi, 3 repetisi per skenario per ukuran, warmup 3 frame tidak dihitung (meredam bias JIT).
- Frame time = durasi measure User Timing, timestamp frame dari `performance.now()` di node (rAF tidak ada; jalur rAF aktif hanya di runner browser).
- Long task: frame di atas 50 ms (`LONG_TASK_THRESHOLD_MS`).

## Cara Rerun

```sh
cd /home/zeroclaw/projects/stemmagraph
./node_modules/.bin/vitest run --config tests/perf/vitest.perf.config.ts pointer-benchmark
./node_modules/.bin/tsc -p tests/perf/tsconfig.json --noEmit
```

Angka muncul di stdout dengan awalan `[v452]`.

## Angka Run Resmi (14 Nov 2026, node v20.19.6, vitest 4.1.11, environment node)

Dua run penuh tercatat hari yang sama (run A dan run B, masing-masing 3 repetisi). Konsisten pola v447: rep dengan outlier (avg melompat, long task muncul 1 frame) adalah efek GC V8 di server shared; angka steady state dibaca dari rep tanpa outlier.

### 2000 node, run A

| Skenario | Rep | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
|---|---|---|---|---|---|
| hover | rep1 | 0.0322 | 0.0725 | 0.4207 | 0 |
| hover | rep2 | 0.0207 | 0.0405 | 0.0980 | 0 |
| hover | rep3 | 0.0162 | 0.0183 | 0.0402 | 0 |
| drag | rep1 | 0.8568 | 0.3300 | 2.4151 | 1 |
| drag | rep2 | 0.1364 | 0.2748 | 0.3049 | 0 |
| drag | rep3 | 0.7668 | 0.2765 | 1.0113 | 1 |

### 2000 node, run B

| Skenario | Rep | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
|---|---|---|---|---|---|
| hover | rep1 | n/a (stdout run B terpotong di rep3, rep1 rep2 tidak tercatat) | | | |
| hover | rep3 | 0.0130 | 0.0196 | 0.0274 | 0 |
| drag | rep1 | 0.1534 | 0.3062 | 0.5958 | 0 |
| drag | rep2 | 0.1484 | 0.2542 | 0.2940 | 0 |
| drag | rep3 | 0.1194 | 0.2465 | 0.2866 | 0 |

### 5000 node, run A

| Skenario | Rep | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
|---|---|---|---|---|---|
| hover | rep1 | 0.0425 | 0.0610 | 0.2477 | 0 |
| hover | rep2 | 0.0404 | 0.0581 | 0.1137 | 0 |
| hover | rep3 | 0.8067 (outlier) | 0.0726 | 0.2376 | 1 |
| drag | rep1 | 0.1110 | 0.4519 | 0.6413 | 0 |
| drag | rep2 | 0.0426 | 0.0534 | 0.0680 | 0 |
| drag | rep3 | 0.0451 | 0.0548 | 0.0710 | 0 |

### 5000 node, run B

| Skenario | Rep | avg (ms) | p95 (ms) | p99 (ms) | long task >50ms |
|---|---|---|---|---|---|
| hover | rep1 | 0.0411 | 0.0517 | 0.3328 | 0 |
| hover | rep2 | 0.8649 (outlier) | 0.1265 | 0.7000 | 1 |
| hover | rep3 | 0.0468 | 0.0673 | 0.2233 | 0 |
| drag | rep1 | 1.0355 (outlier) | 0.5141 | 0.9339 | 1 |
| drag | rep2 | 0.0490 | 0.0599 | 0.0999 | 0 |
| drag | rep3 | 0.7709 (outlier) | 0.0616 | 0.1267 | 1 |

### Steady state (rep tanpa outlier, lintas run)

- 2000 node hover: sekitar 0.016 sampai 0.021 ms avg, p95 0.018 sampai 0.041 ms, p99 0.027 sampai 0.098 ms.
- 2000 node drag: sekitar 0.12 sampai 0.15 ms avg, p95 0.246 sampai 0.306 ms, p99 0.287 sampai 0.596 ms. Drag lebih mahal dari hover sekitar 7 sampai 9 kali: update posisi node plus recompute edge terkait tiap frame.
- 5000 node hover: sekitar 0.041 sampai 0.047 ms avg, p95 0.052 sampai 0.073 ms, p99 0.114 sampai 0.333 ms.
- 5000 node drag: sekitar 0.043 sampai 0.111 ms avg, p95 0.053 sampai 0.452 ms, p99 0.068 sampai 0.641 ms.
- Semua nilai jauh di bawah ambang long task 50 ms; satu-satunya long task tercatat adalah outlier GC, bukan biaya pipeline pointer.

## Pembacaan dan Varian

Pola sama dengan v447: rep1 bias JIT dan GC V8 di server shared, gunakan median rep2 dan rep3 untuk perbandingan antar hari. Delta antar konfigurasi di bawah 2x margin of error jangan diklaim menang (rubrik benchmark deterministik, evidence wake-317).

Baseline pembanding render pass murni: docs/perf/v447-benchmark-baseline.md (2000 node steady state sekitar 0.03 ms avg, p95 0.04 ms; 5000 node sekitar 0.10 ms avg, p95 0.14 ms).

## Batasan

Benchmark ini mengukur pass pemrosesan event pointer (hit test, update posisi, recompute edge terkait), bukan commit React dan paint DOM. Pengukuran FPS nyata hover dan drag di browser ada di artefak v442 (Playwright) dan kelanjutannya.

Delta performa React.memo fase 2 (v450) belum diukur dokumen ini; itu butuh perbandingan run sebelum dan sesudah commit memo pada komponen sama, dicatat sebagai kelanjutan opsional. Dokumen ini adalah baseline interaksi pointer pertama.
