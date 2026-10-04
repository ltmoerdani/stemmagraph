# Worklog: STG v174-ii MEMUAT-ALIAS (attempt 3)

Branch: improve/stg-v174ii-memuat-alias (dari develop ccc022dc)

Komit:
1. 2ca2d34 - test(genealogy): 3 kasus inti alias memuat dansanak dan dansa-dansi (komit dini, push segera)
2. 1a1cff3 - feat(genealogy): entri alias sibling dansanak dan dansa-dansi plus 12 kasus test lengkap

File diubah:
- src/lib/genealogy/kinship-aliases.ts (add-only, 2 entri baru: dansanak, dansa-dansi, kind sibling)
- src/lib/genealogy/kinship-aliases-memuat.test.ts (baru, 12 kasus)

Hasil verifikasi:
- vitest (5 file alias): 74/74 pass
- tsc --noEmit: rc 0
- eslint (scoped 2 file): rc 0
- em dash di diff: 0

Kedua komit sudah terpush ke origin. Tidak ada merge ke develop/main. Menunggu perintah QA/PM.
