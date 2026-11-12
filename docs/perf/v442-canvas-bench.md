# Benchmark Canvas v442 AC3 (append 2026-11-12T19:53:00.749Z)

Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).
Sampel: 8 detik per run, 2 run per skenario, chromium headless.
beginFrame CDP HeadlessExperimental: tidak tersedia, sampling via rAF.

## Initial load (build data + mount + layout + render pertama)

| Node | Load ms |
|---|---|
| 2000 | 3081.0 |
| 5000 | 3417.5 |

## Skenario rAF (drag, zoom, hover-drag)

| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |
|---|---|---|---|---|---|---|
| hover-drag | 2000 | 29.57 | 83.40 | 74 | 31.2 | 237 |
| hover-drag | 2000 | 35.69 | 66.70 | 82 | 28.6 | 287 |
| drag | 2000 | 33.49 | 83.30 | 79 | 29.5 | 268 |
| drag | 2000 | 33.46 | 66.70 | 76 | 28.4 | 268 |
| zoom | 2000 | 26.33 | 83.30 | 61 | 28.9 | 211 |
| zoom | 2000 | 39.46 | 66.70 | 78 | 24.7 | 316 |
| hover-drag | 5000 | 28.95 | 83.30 | 80 | 34.5 | 232 |
| hover-drag | 5000 | 32.12 | 83.30 | 77 | 30.0 | 257 |
| drag | 5000 | 35.61 | 66.70 | 79 | 27.7 | 285 |
| drag | 5000 | 33.49 | 83.30 | 80 | 29.9 | 268 |
| zoom | 5000 | 36.87 | 66.70 | 74 | 25.1 | 295 |
| zoom | 5000 | 39.37 | 66.70 | 78 | 24.8 | 315 |

## Memory usedJSHeapSize pasca GC manual (median 3 sampel)

| Node | Median MB | Sampel byte |
|---|---|---|
| 2000 | 31.6 | 33100000, 33100000, 33100000 |
| 5000 | 31.6 | 33100000, 33100000, 33100000 |

## Ringkasan FPS rata-rata

- 2000 node: drag 33.47 fps, hover-drag 32.63 fps, zoom 32.90 fps.
- 5000 node: drag 34.55 fps, hover-drag 30.53 fps, zoom 38.12 fps.
