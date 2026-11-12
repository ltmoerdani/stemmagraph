# Findings Audit Kinerja Canvas v442 (RISET-ONLY)

Branch: improve/stg-v442-canvas-perf-audit. Tanggal run: 2026-11-12/13 UTC. Status: riset, tanpa perubahan kode produksi (src/ dan server/ tidak disentuh).

## Metodologi

Runner Playwright (chromium headless, 1 worker) via host bench vite dev port 5201, dataset deterministik `buildPerfFamily` dari fixture `__perf__/perf-graph-sizes` (couples, 2-3 anak per pasangan, satu hub node ber-24 edge). Sampling frame pakai delta `requestAnimationFrame`, 8 detik per run, 2 run per skenario. Frame drop dihitung dari budget 32ms. Memory diukur `performance.memory.usedJSHeapSize` pasca GC manual CDP `HeapProfiler.collectGarbage`, 3 sampel, median. Probe `HeadlessExperimental.beginFrame` CDP dicoba sekali per test: hasilnya tidak tersedia di setup headless ini, jadi semua angka memakai sampling rAF biasa.

Skenario AC3: hover stabil di node hub (24 edge) sambil drag node lain (hover-drag), drag polos, zoom wheel in-out. Skenario AC4: sama (drag, zoom) dengan override query param `perfVisibility=on|off` yang dibaca `visibility.ts`, hanya di host bench, perilaku app default tidak berubah.

## Angka baseline AC3 (5000 node kecuali disebut)

Initial load (build data + mount + layout + render pertama): 2000 node 3081.0 ms, 5000 node 3417.5 ms.

FPS rata-rata 2 run (p95 delta ms, drop %):

- 2000 node: drag 33.47 (83.3, 28.4-29.5), hover-drag 32.63 (66.7-83.4), zoom 32.90 (66.7-83.3).
- 5000 node: drag 34.55 (66.7-83.3, drop 27.7-29.9), hover-drag 30.53 (83.3, drop 30.0-34.5), zoom 38.12 (66.7, drop 24.8-25.1).

Memory median pasca GC: 2000 node 31.6 MB, 5000 node 31.6 MB (ketiga sampel identik 33.100.000 byte per dataset). Angka identik antar dataset mencurigakan; `performance.memory` di headless ter-kuantisasi kasar, jadi angka ini dipakai sebagai indikasi, bukan pengukuran presisi.

Angka mentah per run ada di `docs/perf/v442-canvas-bench.md`.

## Keputusan A/B AC4 (5000 node)

| Mode | Drag FPS | Zoom FPS | Drag p95 | Zoom p95 |
|---|---|---|---|---|
| on (default app) | 32.60 | 27.06 | 66.8-83.3 | 83.5-100.0 |
| off | 30.53 | 32.46 | 83.3-100.0 | 66.7-99.9 |

Temuan: mode ON membantu drag (+2.07 fps, ~6.8%) tapi justru lebih lambat saat zoom (-5.40 fps, ~16.6%). Pola konsisten dengan mekanisme culling viewport: saat drag, jumlah elemen ter-render stabil kecil; saat zoom, viewport berubah tiap frame sehingga mount/unmount node baru terjadi agresif dan menambah long task (zoom ON p95 sampai 100ms).

Keputusan: pertahankan default ON (threshold 500, keputusan S-09 AC3) untuk saat ini. Data satu run headless belum cukup untuk membalik keputusan existing, dan trade-off zoom perlu konfirmasi di hardware nyata. Tidak ada perubahan kode dari A/B ini. Angka mentah ada di `docs/perf/v442-canvas-ab.md`.

Sinyal tambahan dari baseline: hover-drag 5000 node 30.53 fps vs drag polos 34.55 fps, selisih 4 fps mengindikasikan biaya highlight adjacency saat hover node ber-edge banyak. Frame drop 24-38% di semua skenario dengan p95 66-100ms menunjukkan long task, bukan kekurangan fill-rate, sebagai penyebab utama jank.

## Rekomendasi ladder 6 level (checklist vendor React Flow, urut prioritas dari angka baseline)

1. Memoisasi komponen node/edge plus selector store granular. Checklist vendor: bungkus custom node dengan memo, jangan lempar object/array inline ke props. Target: hilangkan selisih hover 4 fps di 5000 node (30.53 mendekati 34.55). Biaya rendah, dampak langsung ke skenario terukur.
2. Kurangi scope re-render highlight adjacency: batasi edge/node yang ikut styling hover ke tetangga langsung, bukan iterasi seluruh edges array tiap hover. Target: drop % hover-drag 30.0-34.5 turun ke level drag 27-30.
3. CSS containment di konten node (`contain: layout paint` atau `content-visibility: auto` pada subtree node). Checklist vendor menyebut ini untuk membatasi style/layout ulang. Target: p95 delta drag turun dari 66-100ms ke di bawah 50ms.
4. Layout dagre/elk pindah ke Web Worker. Initial load 5000 node 3417 ms didominasi layout main thread; worker membuat load bisa overlap dengan render skeleton. Target: load 5000 node di bawah 1500 ms. Biaya menengah, perlu refactor wiring layout.
5. Edge path caching dan edge murah untuk graf besar: cache path bezier per posisi endpoint, pertimbangkan straight edge di atas threshold. Berhubungan dengan drag p95 (tiap drag mengubah posisi endpoint edge terhubung). Target: p95 drag stabil di bawah 66ms.
6. Ganti culling bawaan dengan viewport culling custom yang stabil saat zoom (hysteresis: node tetap ter-render sampai benar-benar keluar viewport besar). Hanya jika trade-off zoom ON (-5.4 fps) terkonfirmasi di hardware nyata. Paling mahal, simpan sebagai langkah terakhir.

Urutan ini disusun dari rasio dampak-terukur atas biaya: item 1-2 menyasar hover penalty yang terukur jelas, item 3-4 menyasar long task dan initial load, item 5-6 menyasar sisa jank dengan biaya refactor tertinggi.

## Known issues

1. `HeadlessExperimental.beginFrame` tidak tersedia di setup headless chromium ini; probe dicatat, pengukuran tetap via rAF. Dampak: angka FPS headless bisa beda dari hardware nyata.
2. Sampel heap identik antar dataset (31.6 MB median) mengindikasikan kuantisasi `performance.memory` headless; pengukuran memory presisi butuh tracing CDP `Heap` atau run berprofiler.
3. Run pertama parsial (per dataset terpisah) sempat menimpa laporan karena afterAll Playwright jalan per proses; sudah diperbaiki, laporan sekarang mode append dan run penuh sekali proses.
4. Run benchmark gagal dua kali sebelum lulus: `computeMedian` belum diimpor (diperbaiki) dan syntax error blok heap (diperbaiki). Data final dari run yang lulus utuh.

## Batasan

Semua angka dari chromium headless di satu mesin server, sekali sesi, noise antar run terlihat sampai 5 fps (zoom 2000 node: 26.33 vs 39.46). Rekomendasi ladder adalah arah optimasi, bukan komitmen angka. Riset-only: tidak ada perubahan perilaku app di branch ini, hanya file test dan docs.
