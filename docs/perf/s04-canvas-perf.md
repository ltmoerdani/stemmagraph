# Catatan Kinerja Canvas S-04

Tanggal: 2026-10-22
Branch: improve/s04-kinerja

## Latar

Laporan A/B v177-ii (`docs/perf/canvas-ab-report.md`) menunjukkan culling
`onlyRenderVisibleElements` tidak menaikkan FPS secara berarti (241 node:
~35-40 FPS di kedua mode; 5000 node: hasil on-off saling menyusul).
Kesimpulannya bottleneck bukan pada culling viewport.

## Temuan

`FamilyMemberNode` sudah `React.memo` sejak S-09 dengan stable hydration
cache untuk nodes/edges (konstruksi memo per lingkup generasi). Ketiga
komponen edge (`MarriageEdge`, `ParentChildEdge`, `SiblingEdge`) belum
dibungkus `memo`, sehingga setiap re-render canvas (drag, zoom, selection)
menggambar ulang seluruh SVG path edge padahal koordinatnya tidak berubah.

## Perubahan

1. Ketiga komponen edge dibungkus `React.memo` + `displayName` (pola sama
   dengan `FamilyMemberNode`).
2. Test kontrak `src/components/FamilyTree/edges/edges.memo.test.tsx`:
   ketiga edge harus memo, punya displayName, dan render path tanpa crash.
3. `eslint.config.js`: arsip/scratch non-produksi (`.qa-archive`,
   `.probe-wake`, `.tmp-*`, `tmp*`, `*.log`) masuk ignores sehingga hasil
   lint hanya mencerminkan kode sumber nyata.

## Ekspektasi & Ukuran Lanjutan

Manfaat memo edge baru terasa saat interaksi lokal (drag satu node, edit
satu kartu): edge tetap di-skip React reconciliation. Untuk pengukuran
FPS interaksi drag berikutnya, runner browser v177-ii bisa dipakai ulang
dengan skenario drag node tunggal dibanding skenario pan/zoom.
