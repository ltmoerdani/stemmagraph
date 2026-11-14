# A/B Post-Memo Canvas v456 (Fase 3 v442)

Tanggal: 14 Nov 2026. Branch: improve/stg-v456-canvas-ab-postmemo (base develop 9f6ccb8 + fix regresi f934bb1). Lingkup: re-run benchmark browser nyata pasca memo v446 (fase 1) dan v450 (fase 2), membandingkan dengan baseline pra-memo 12 Nov, plus fix regresi runtime yang ditemukan saat probe.

## Perbaikan Awal: Regresi Runtime v450

Probe manual host bench (playwright-core + chromium headless, nodes=100) menemukan halaman crash: ReferenceError: memo is not defined. Akar: v450 fase 2 mem-wrap memo() di FamilyTreeControls.tsx dan MemberCard.tsx TANPA menambahkan import memo. Gate vitest v450 (environment node, komponen tidak dimount di browser) tidak menangkap. Fix: import React, { memo } pada kedua file (komit f934bb1, 2 berkas 2 baris). Pasca fix, host READY 6 detik, nihil console error.

## Metodologi

Runner dan host identik dengan run 12 Nov: canvas-bench-v442.pwtest.ts, host vite dev port 5201, chromium headless (156.0.8078.4), fixture buildPerfFamily deterministik, 8 detik per skenario per run, 2 run, dataset 2000 dan 5000 node, sampling rAF (beginFrame CDP tidak tersedia), long task threshold 32 ms untuk drop, heap usedJSHeapSize pasca GC manual median 3 sampel. Perbedaan tunggal: HEAD develop kini memuat memo v446+v450 (ReactFlowFamilyTree, TreeCanvas) plus fix import.

## Hasil Run Pasca-Memo (run resmi, 14 Nov 2026, 10:1x WIB)

### Initial load

| Node | Load ms |
|---|---|
| 2000 | 1981.5 |
| 5000 | 3087.4 |

### Skenario rAF (2 run per skenario)

| Skenario | Node | FPS run 1 | FPS run 2 | p95 delta ms | Drop % run 1 | Drop % run 2 | Sampel per run |
|---|---|---|---|---|---|---|---|
| hover-drag | 2000 | 44.96 | 46.19 | 50.0-50.1 | 18.6 | 19.5 | 360/370 |
| drag | 2000 | 46.95 | 45.18 | 50.0 | 17.0 | 18.8 | 376/362 |
| zoom | 2000 | 44.62 | 49.69 | 33.4-66.6 | 13.4 | 12.3 | 359/398 |
| hover-drag | 5000 | 47.00 | 48.11 | 50.0 | 18.7 | 16.9 | 380/385 |
| drag | 5000 | 47.73 | 46.21 | 50.0 | 17.0 | 16.8 | 370/382 |
| zoom | 5000 | 44.35 | 46.47 | 50.0-50.1 | 16.5 | 15.9 | 357/372 |

Heap median 31.6 MB untuk kedua ukuran (identik pra-memo, menandakan memo tidak menambah jejak memori signifikan).

## Perbandingan vs Baseline Pra-Memo (12 Nov, dokumen v442 append 2026-11-12T19:53)

| Skenario | Node | FPS pra-memo (2 run) | FPS pasca-memo (2 run) | Delta FPS | Drop % pra | Drop % pasca |
|---|---|---|---|---|---|---|
| hover-drag | 2000 | 29.57 / 35.69 | 44.96 / 46.19 | +12.9 rata-rata | 31.2 / 28.6 | 18.6 / 19.5 |
| drag | 2000 | 33.49 / 33.46 | 46.95 / 45.18 | +12.6 rata-rata | 29.5 / 28.4 | 17.0 / 18.8 |
| zoom | 2000 | 26.33 / 39.46 | 44.62 / 49.69 | +14.3 rata-rata | 28.9 / 24.7 | 13.4 / 12.3 |
| hover-drag | 5000 | 28.95 / 32.12 | 47.00 / 48.11 | +17.0 rata-rata | 34.5 / 30.0 | 18.7 / 16.9 |
| drag | 5000 | 35.61 / 33.49 | 47.73 / 46.21 | +12.4 rata-rata | 27.7 / 29.9 | 17.0 / 16.8 |
| zoom | 5000 | 36.87 / 39.37 | 44.35 / 46.47 | +7.3 rata-rata | 25.1 / 24.8 | 16.5 / 15.9 |

## Evaluasi vs Pilar 4 Vision (canvas React Flow mulus)

1. Semua skenario kini 44-50 FPS, naik dari 26-40 FPS; target 60 FPS belum tercapai penuh tapi frame drop turun drastis dari 24-35% ke 12-19%.
2. Kenaikan terbesar justru di 5000 node hover-drag (+17 FPS, drop 30-34% ke 16-19%): memo TreeCanvas + ReactFlowFamilyTree efektif memangkas re-render per frame interaksi.
3. Initial load 2000 node membaik (3081 ke 1981 ms, di run beda hari; 5000 node setara 3417 vs 3087). Catatan: load run lintas hari dipengaruhi variasi server, angka interaksi lebih stabil.
4. Rekomendasi ladder fase 4 (dari findings v442): onlyRenderVisibleElements A/B berikutnya, lalu node kustom ringan; memo fase 2 sudah membayar sebagian besar utang render.
5. Regresi runtime v450 yang ditemukan memperkuat catatan metodologi: gate perf WAJIB menyertakan smoke mount browser (pwtest host ini cocok jadi smoke gate, bukan hanya vitest node).

## Cara Rerun

```sh
cd /home/zeroclaw/projects/stemmagraph
npm run dev &  # vite di 5201
npx playwright test canvas-bench-v442
./node_modules/.bin/tsc -p tests/perf/tsconfig.json --noEmit
```

Output pwtest append ke docs/perf/v442-canvas-bench.md; pindahkan blok append ke dokumen baru seperti pola wake ini.
