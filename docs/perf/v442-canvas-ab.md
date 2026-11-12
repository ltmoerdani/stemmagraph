# A/B onlyRenderVisibleElements v442 AC4 (append 2026-11-12T19:55:59.639Z)

Dataset: 5000 node buildPerfFamily, 8 detik per run, 2 run per skenario, chromium headless.

| Mode | Skenario | Run | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |
|---|---|---|---|---|---|---|---|
| on | drag | 1 | 33.85 | 66.80 | 82 | 30.3 | 271 |
| on | drag | 2 | 31.35 | 83.30 | 83 | 32.8 | 253 |
| on | zoom | 1 | 28.41 | 83.50 | 76 | 33.2 | 229 |
| on | zoom | 2 | 25.71 | 100.00 | 72 | 35.0 | 206 |
| off | drag | 1 | 32.70 | 83.30 | 84 | 32.1 | 262 |
| off | drag | 2 | 28.36 | 100.00 | 78 | 34.4 | 227 |
| off | zoom | 1 | 37.32 | 66.70 | 80 | 26.6 | 301 |
| off | zoom | 2 | 27.60 | 99.90 | 70 | 31.7 | 221 |

## Ringkasan FPS rata-rata per mode

- mode on, drag: 32.60 fps
- mode on, zoom: 27.06 fps
- mode off, drag: 30.53 fps
- mode off, zoom: 32.46 fps
