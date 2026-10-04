# STG v174-iii: rantai atas generasi atas + guard (anti-dead)

Repo: stemmagraph. Branch: improve/stg-v174iii-rantai-atas (dari develop a84f0bc).

## Komit
- 8bc191c feat(genealogy): tambah alias buyut ri dan buyut jw ancestor terkualifikasi dialek (add-only, notes/417)
- 1be1467 test(genealogy): 12 kasus rantai atas buyut ri/jw, guard homonim, add-only count (v174-iii)

## File diubah
- src/lib/genealogy/kinship-aliases.ts: tambah 2 entri baru (add-only) 'buyut ri' (ancestor depth 4 region Ri) dan 'buyut jw' (ancestor depth 3 region Jw). Entri lama tidak disentuh.
- src/lib/genealogy/kinship-aliases-rantai.test.ts: baru, 12 kasus.

## Verifikasi (06:06 WIB)
- vitest 6 berkas alias (existing 5 + baru): 6 files passed, 86 tests passed.
- tsc --noEmit: rc 0.
- eslint scoped 2 file diubah: rc 0.
- em dash di diff a84f0bc..HEAD: 0 kemunculan.
- git status bersih, origin sinkron di 1be1467.

## Catatan
Baseline jumlah lema develop (a84f0bc) ternyata 39, bukan 32 seperti asumsi awal draft test; dikoreksi ke 41 (39+2) sebelum lolos. Dicatat di sini untuk akurasi historis, bukan revisi ulang task.

Jam: 06:01 mulai branch, 06:05 test ditulis, 06:06 push pertama, 06:07 gates lulus semua.
