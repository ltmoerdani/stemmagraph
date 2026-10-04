# 2026-09-20 v128-ii-a RESN wiring (gedcom)

Branch: improve/stg-v128-ii-resn-wiring (repo: stemmagraph)

- 45ad74a feat(gedcom): delegasi RESN export pure (resn-export.ts + test)
- 4c99b17 feat(gedcom): delegasi RESN import pure (resn-import.ts + test)
- 59c2756 fix(gedcom): koreksi kasus lowercase shared di test export

Insiden: kasus test 'lowercase shared' awal saya isi input 'SHARED'; fungsi pure
mencocokkan 'shared' secara eksak sehingga expected null gagal (received PRIVACY).
Gate pertama keliru terbaca lolos karena rc diambil dari tail, bukan vitest.
Koreksi: input diganti 'shared', gate diulang tanpa pipe, hasil 16/16.

Verifikasi akhir: vitest 16/16, tsc rc 0, eslint rc 0, 0 em dash. Push OK.
File baru: 4 (resn-export.ts/.test.ts, resn-import.ts/.test.ts). resn.ts tak disentuh.
