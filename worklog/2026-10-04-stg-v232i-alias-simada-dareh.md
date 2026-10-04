# STG v232-i: alias kalimbubu simada dareh (improve/stg-v232i-alias-simada-dareh)

Tanggal: 2026-10-04, sekitar 20:45 WIB

## Konteks
- Cabang sudah ada di origin, dibuat PM dari tip develop 59fa6136. Checkout + pull, already up to date.
- Working tree saat checkout berisi residu attempt sebelumnya (note alias versi TRI-SOURCE, bump parsial 15/16, testfile untracked). Dirapikan ke kontrak dual-source sebelum commit.

## Dikerjakan
- Komit 1 (d7bb2ee): kinship-aliases.ts tambah tepat 1 key 'kalimbubu simada dareh' (pernikahan, depth 1, Karo, note DUAL-SOURCE: Ginting 2017 OSF DOI 10.31227/osf.io/mz6kh_v1 baris 2095-2096 dan 3212-3213 + JAMPARING Rambe 2025 DOI 10.57235/jamparing.v3i1.4771 baris 196). Plus testfile baru kinship-aliases-simada-dareh.test.ts, 14 kasus (positif kind/depth, normalisasi, negatif homonim simada/dareh, negatif region lain, negatif potongan formula, reciprocitas anak beru, evidence DOI, non-regresi kalimbubu dan puang kalimbubu, guard 29 key sisip alfabetis).
- Komit 2 (7a93a12): bump guard toBe(28) jadi toBe(29) di 15 testfile penghitung key Karo.

## Temuan penting
- grep toBe(28) di HEAD ada 16 testfile. Satu di antaranya, kinship-aliases-kakak-feminin.test.ts baris 100, adalah counter total kind sibling global (28), bukan penghitung key Karo. Sempat terbump salah jadi 29 (gate 2 merah: expected 28 to be 29), dikembalikan ke 28.

## Gates
- vitest standalone: 14/14 pass
- vitest src/lib/genealogy: 1126/1126 pass, 0 fail (basis 1112, naik 14)
- tsc --noEmit: rc 0
- lint: rc 1, delta 0 dari baseline (first-hand: origin/develop juga rc 1, 15 problems, 2 error parsing sama di .qa-archive/)
- diff origin/develop..HEAD em dash: 0
- merge origin/develop: already up to date

## Status
Push final 7a93a12 di origin (ls-remote terverifikasi). Tidak merge ke develop/main.
