# Kontrak stg-v253xli: key kinship alias `ading`

Tanggal: 14 Okt 2026. Status: kukuh PM, dual-source terverifikasi, sumber tidak diganti.

## Item

Key `ading` masuk map utama `KINSHIP_ALIASES` di `src/lib/genealogy/kinship-aliases.ts`.

- kind `sibling`, depth 1
- TANPA qualifier, TANPA region
- register cak HANYA tercatat di note (pola entri akak baris 179)
- penyisipan di klaster sibling dekat akak, urutan alfabetis internal map: ading sebelum akak
- makna basis: ading = adik, relasi saudara seumur (sibling), BUKAN parent-child

## Sumber (dual, terverifikasi)

1. KBBI III mirror kbbi.web.id/ading, HTTP 200, akses 14 Okt 2026: ading n cak adik, satu lema, nihil homograf bernomor, nihil label daerah.
2. Wiktionary ID revid 1292120 via api.php: blok Bahasa Indonesia n cak adik, rujukan R:KBBI Daring, flag rfv dicatat jujur.

## Guard test (testfile dedikasi `kinship-aliases-ading.test.ts`, min 9 kasus)

a. Homonim antarbahasa Wiktionary TIDAK dipetakan: blok bjn Banjar (adik, adinda), ilo Ilocano, bve Bima, bkr Bakumpai, pse Ogan (adik plus ragam adeng adieng).
b. `adeng` dan `adieng` BUKAN key.
c. Makna basis sibling depth 1, bukan parent-child.
d. Non-difusi: `adik` tetap BUKAN key sementara `ading` key (pola bungsu).
e. Substring misleading di note kalimbubu (baris 628) BUKAN dup key.
f. `adinda` BUKAN key terpisah baru dari item ini; entri existing (hor, hormat) tak tersentuh.

## Guard global

Di tip 04d7a80 testfile existing menahan literal 128 (toHaveLenght dan toBe, contoh kinship-aliases-ucu.test.ts baris 77-78). Semua literal guard itu naik 128 jadi 129, konsisten toHaveLength dan toBe. Literal revid historis (1286612, 1471283) dan komentar historis tidak disentuh.

## Gates

npx vitest run testfile ading; npx tsc --noEmit; npx eslint berkas sentuh; npm run build (guard pure-core prebuild). Em dash 0 di semua berkas sentuh. Branch: improve/stg-v253xli-ading dari develop 04d7a80.
