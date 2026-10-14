# Laporan Canvas A/B on-off v177-ii

Tanggal: 2026-10-14T00:24:28.183Z
Sampel: 10 detik per run, 3 run per kombinasi, interaksi drag + pan/zoom.

| Mode | Node | FPS rata-rata | p95 rAF delta (ms) |
|---|---|---|---|
| on | 241 | 40.33 | 66.70 |
| on | 241 | 30.25 | 83.40 |
| on | 241 | 35.85 | 83.20 |
| off | 241 | 39.98 | 66.70 |
| off | 241 | 28.76 | 83.30 |
| off | 241 | 35.88 | 66.80 |
| on | 5000 | 46.27 | 50.00 |
| on | 5000 | 40.66 | 66.70 |
| on | 5000 | 40.45 | 66.70 |
| off | 5000 | 34.57 | 66.70 |
| off | 5000 | 46.77 | 50.00 |
| off | 5000 | 47.86 | 50.00 |

Catatan: mode on memaksa onlyRenderVisibleElements aktif, off mematikan;
default app tanpa query param tidak berubah (override hanya di host perf).
