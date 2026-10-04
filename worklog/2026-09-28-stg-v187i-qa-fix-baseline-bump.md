# Worklog: STG v187-i QA-fix baseline bump

Tanggal: 2026-09-28 12:56 WIB
Branch: improve/stg-v187i-alias-nande
Repo: /home/zeroclaw/projects/stemmagraph

## Konteks
QA PM menemukan 3 karakterisasi baseline belum dibump pasca penambahan 1 entri nande (v187-i, region Karo, depth 1, kind sibling).

## Perubahan
- src/lib/genealogy/kinship-aliases-kakak-feminin.test.ts: judul dan expect total entri sibling 27 jadi 28.
- src/lib/genealogy/kinship-aliases-karo.test.ts: kasus negatif kaka, area Karo 4 jadi 5, list region ditambah nande.
- src/lib/genealogy/kinship-aliases-kakak.test.ts: kasus klaster kakak maskulin, total depth 1 25 jadi 26.

Hanya 3 baris judul dan expect yang diubah, tidak menyentuh berkas lain.

## Commit
cc282a4e5ab28b4847f1804dd8a35748d6ccb811
test(genealogy): bump 3 karakterisasi baseline sibling 27 jadi 28, karo 4 jadi 5, depth1 25 jadi 26 pasca v187-i

## Verifikasi
npx vitest run src/lib/genealogy
Test Files: 38 passed (38)
Tests: 569 passed (569)
Durasi: 75.98s
Naik dari baseline 565 pass 4 fail sebelumnya, sekarang 0 fail.

## Push
git push origin improve/stg-v187i-alias-nande sukses. SHA remote sama dengan lokal: cc282a4e5ab28b4847f1804dd8a35748d6ccb811.

## Status
Selesai. Tidak melakukan merge, tidak menyentuh develop.
