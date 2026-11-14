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
# Benchmark Canvas v442 AC3 (append 2026-11-14T03:57:00.436Z)

Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).
Sampel: 8 detik per run, 2 run per skenario, chromium headless.
beginFrame CDP HeadlessExperimental: tidak tersedia, sampling via rAF.

## Initial load (build data + mount + layout + render pertama)

| Node | Load ms |
|---|---|
| 2000 | 2987.3 |
| 5000 | 1809.8 |

## Skenario rAF (drag, zoom, hover-drag)

| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |
|---|---|---|---|---|---|---|
| hover-drag | 2000 | 45.86 | 50.00 | 68 | 18.5 | 367 |
| hover-drag | 2000 | 49.21 | 50.00 | 61 | 15.5 | 394 |
| drag | 2000 | 45.74 | 50.00 | 61 | 16.7 | 366 |
| drag | 2000 | 48.62 | 49.90 | 63 | 16.2 | 389 |
| zoom | 2000 | 53.29 | 33.30 | 33 | 7.7 | 427 |
| zoom | 2000 | 50.97 | 33.40 | 39 | 9.6 | 408 |
| hover-drag | 5000 | 46.95 | 50.00 | 65 | 17.3 | 376 |
| hover-drag | 5000 | 50.24 | 33.40 | 60 | 14.9 | 402 |
| drag | 5000 | 44.96 | 50.10 | 59 | 16.4 | 360 |
| drag | 5000 | 45.84 | 50.00 | 54 | 14.7 | 367 |
| zoom | 5000 | 51.43 | 33.40 | 33 | 8.0 | 412 |
| zoom | 5000 | 57.24 | 16.80 | 16 | 3.5 | 458 |

## Memory usedJSHeapSize pasca GC manual (median 3 sampel)

| Node | Median MB | Sampel byte |
|---|---|---|
| 2000 | 31.6 | 33100000, 33100000, 33100000 |
| 5000 | 31.6 | 33100000, 33100000, 33100000 |

## Ringkasan FPS rata-rata

- 2000 node: drag 47.18 fps, hover-drag 47.54 fps, zoom 52.13 fps.
- 5000 node: drag 45.40 fps, hover-drag 48.60 fps, zoom 54.33 fps.
# Benchmark Canvas v442 AC3 (append 2026-11-14T04:07:25.843Z)

Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).
Sampel: 8 detik per run, 2 run per skenario, chromium headless.
beginFrame CDP HeadlessExperimental: tidak tersedia, sampling via rAF.

## Initial load (build data + mount + layout + render pertama)

| Node | Load ms |
|---|---|
| 2000 | 2199.4 |
| 5000 | 2001.1 |

## Skenario rAF (drag, zoom, hover-drag)

| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |
|---|---|---|---|---|---|---|
| hover-drag | 2000 | 43.45 | 50.10 | 75 | 21.6 | 348 |
| hover-drag | 2000 | 39.96 | 66.60 | 80 | 25.0 | 320 |
| drag | 2000 | 40.63 | 50.10 | 72 | 22.0 | 327 |
| drag | 2000 | 39.07 | 66.70 | 76 | 24.3 | 313 |
| zoom | 2000 | 44.05 | 66.60 | 53 | 15.0 | 353 |
| zoom | 2000 | 51.83 | 33.40 | 45 | 10.8 | 415 |
| hover-drag | 5000 | 46.07 | 50.00 | 70 | 19.0 | 369 |
| hover-drag | 5000 | 47.49 | 50.00 | 60 | 15.7 | 382 |
| drag | 5000 | 47.93 | 50.00 | 63 | 16.4 | 384 |
| drag | 5000 | 43.97 | 50.00 | 71 | 20.2 | 352 |
| zoom | 5000 | 53.43 | 33.30 | 22 | 5.1 | 431 |
| zoom | 5000 | 56.02 | 16.80 | 18 | 4.0 | 449 |

## Memory usedJSHeapSize pasca GC manual (median 3 sampel)

| Node | Median MB | Sampel byte |
|---|---|---|
| 2000 | 31.6 | 33100000, 33100000, 33100000 |
| 5000 | 31.6 | 33100000, 33100000, 33100000 |

## Ringkasan FPS rata-rata

- 2000 node: drag 39.85 fps, hover-drag 41.71 fps, zoom 47.94 fps.
- 5000 node: drag 45.95 fps, hover-drag 46.78 fps, zoom 54.73 fps.
# Benchmark Canvas v442 AC3 (append 2026-11-14T04:10:30.847Z)

Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).
Sampel: 8 detik per run, 2 run per skenario, chromium headless.
beginFrame CDP HeadlessExperimental: tidak tersedia, sampling via rAF.

## Initial load (build data + mount + layout + render pertama)

| Node | Load ms |
|---|---|
| 2000 | 2795.3 |
| 5000 | 2219.5 |

## Skenario rAF (drag, zoom, hover-drag)

| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |
|---|---|---|---|---|---|---|
| hover-drag | 2000 | 45.96 | 50.00 | 74 | 20.1 | 368 |
| hover-drag | 2000 | 46.83 | 50.00 | 63 | 16.8 | 375 |
| drag | 2000 | 37.88 | 66.70 | 74 | 24.2 | 306 |
| drag | 2000 | 43.48 | 50.10 | 73 | 21.0 | 348 |
| zoom | 2000 | 53.73 | 33.30 | 41 | 9.5 | 430 |
| zoom | 2000 | 49.35 | 50.00 | 56 | 14.2 | 395 |
| hover-drag | 5000 | 45.07 | 50.00 | 75 | 20.8 | 361 |
| hover-drag | 5000 | 47.75 | 50.00 | 64 | 16.7 | 384 |
| drag | 5000 | 45.92 | 50.00 | 68 | 18.5 | 368 |
| drag | 5000 | 28.99 | 83.40 | 68 | 29.3 | 232 |
| zoom | 5000 | 51.12 | 33.40 | 42 | 10.3 | 409 |
| zoom | 5000 | 52.65 | 33.30 | 32 | 7.6 | 422 |

## Memory usedJSHeapSize pasca GC manual (median 3 sampel)

| Node | Median MB | Sampel byte |
|---|---|---|
| 2000 | 31.6 | 33100000, 33100000, 33100000 |
| 5000 | 31.6 | 33100000, 33100000, 33100000 |

## Ringkasan FPS rata-rata

- 2000 node: drag 40.68 fps, hover-drag 46.40 fps, zoom 51.54 fps.
- 5000 node: drag 37.46 fps, hover-drag 46.41 fps, zoom 51.89 fps.
