# v235-i: alias anak beru menteri (Karo, komposit anak beru fase ii)

Tanggal: 4 Okt 2026, selesai 22:50 UTC+7. Cabang: improve/stg-v235i-ab-menteri (HEAD 4dcca68, origin sinkron).

Commit:
- a1e687b feat: entri 'anak beru menteri' kind pernikahan depth 1 region Karo di kinship-aliases.ts (add-only 6 baris, sisip alfabetis antara anak beru dan bapa nguda), dual-source Ginting 2017 OSF DOI 10.31227/osf.io/mz6kh_v1 baris 1403 dan 1407-1410 plus Charismo Habeahan baris 80.
- 13420bc test: testfile baru kinship-aliases-ab-menteri.test.ts 12 kasus.
- 4dcca68 test: guard Karo bump 31 jadi 32 di 18 testfile, sisip key di 8 array eksplisit, update guard prefix anak-beru.

File diubah: kinship-aliases.ts (1 entri), kinship-aliases-ab-menteri.test.ts (baru), 18 testfile guard, termasuk anak-beru.test.ts guard prefix.

Gates: standalone 12/12; folder genealogy 1166/1166 (81 file, 0 fail); tsc rc 0; lint rc 1 dengan 15 problems (2 error 13 warning), delta 0 baseline; diff tanpa em dash. Merge origin/develop: already up to date. Tidak sentuh server/, tidak merge ke develop/main. singukuri DITAHAN jadi kasus negatif.
