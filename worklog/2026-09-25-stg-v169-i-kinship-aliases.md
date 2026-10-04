# Stemmagraph v169-i: alias kekerabatan KBBI (fase i pure)

Tanggal: 2026-09-25, sekitar 20:15 WIB
Branch: improve/stg-v169-i-kinship-aliases (base 46d747e == origin/develop)
Repo: /home/zeroclaw/projects/stemmagraph

## Perubahan (add-only, 2 berkas baru)
1. src/lib/genealogy/kinship-aliases.ts, commit 2aa7363
   - Tabel KINSHIP_ALIASES 28 lema (sumber notes 390-401, KBBI edisi III mirror kbbi.web.id akses 2026-09-25)
   - resolveAlias dengan normalisasi: trim, lowercase, buang U+00B7, rapat spasi
   - aliasKinds() terurut alfabetis
2. src/lib/genealogy/kinship-aliases.test.ts, commit 9848050
   - 23 kasus: 1 alias resmi per kind, frasa sub-entri, normalisasi titik tengah, qualifier, note buyut, 8 kasus negatif, determinisme aliasKinds

## Verifikasi (gates)
- vitest run kinship-aliases.test.ts: 23/23 lulus, rc 0
- vitest run src/lib/genealogy: run 1 ada 1 fail flaky (partner-unique-relax.test.ts, error makeRelaxedDb, indikasi beban transform 40s); run 2 hijau penuh 259/259, masuk toleransi
- tsc --noEmit: rc 0
- eslint kedua berkas: rc 0
- grep isPremium/paywall/billing/subscription: 0 hit
- karakter em dash: 0 di kedua berkas

## Push
- origin/improve/stg-v169-i-kinship-aliases = 2aa736397ecaad27c96346b069bab96c423885fb (ls-remote cocok dengan lokal)
- Tidak ada merge ke develop, main/staging tidak disentuh, tidak ada berkas existing berubah

## Status
Selesai, menunggu penugasan QA dari pm.
