# KONTRAK V371-STG-AVERAGE-FAMILY-SIZE-BY-CENTURY FASE I (2026-10-23, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v371-avg-family-size-century (DARI origin/develop 5947469). Base: 5947469.

## Jangkar (terverifikasi first-hand wake-130)
- webtrees wt_statistic.php getAverageFamilySizeByCentury() baris 996 sampai 998: delegasi ChildrenRepository::averageFamilySizeByCentury(), return LineChartPayload (tab Family, rata-rata jumlah anak per keluarga per abad).
- Pola bucketing abad floor(year/100)*100 label string setara v347/v352; rata-rata dibulatkan 2 desimal pola v328/v370.
- BEDA dari modul existing: family-size-stats v270 (distribusi bucket 0/1-2/3-4/5+, tanpa abad), family-size-stacked-by-decade v369 (stack per DEKADE, segmen ukuran), children-per-family (rata-rata global tanpa time axis). v371 = rata-rata anak per abad PERNIKAHAN, satu angka per abad.
- Anti-dup BERSIH first-hand wake-130: git grep average-family-size dan averageFamilySizeByCentury NIHIL di origin/develop, nihil di GOAL_HISTORY dan drafts.

## Deliverable: modul PURE src/lib/stats/average-family-size-by-century.ts + test vitest

1. Input: computeAverageFamilySizeByCentury(records), satu entri PER KELUARGA:
   { familyId: string; marriageDate: string | null; childIds: string[] }
2. marriageDate null = keluarga tanpa tanggal pernikahan terverifikasi: SAH, masuk penghitung undated, TIDAK masuk kohort abad.
3. Keluarga tanpa anak (childIds kosong) TETAP masuk denominator abad pernikahannya (rata-rata terpengaruh nol; konsisten keluarga childless v369 berada di dalam denumerator statistik ukuran).
4. Abad = dekade BUKAN: abad pernikahan floor(tahun / 100) * 100, label string '1800', '1900', dst.
5. Output:
   - centuries: array { century: string, families: number, totalChildren: number, average: number } urut ASC numerik, hanya abad dengan families >= 1;
   - average = totalChildren / families dibulatkan 2 desimal (pola v370);
   - totalFamilies: jumlah families semua abad (di luar undated);
   - totalChildren: jumlah anak semua keluarga terdated;
   - undated: jumlah marriageDate null.
6. Parser strict ber-index pola v347/v370, prefiks 'average-family-size-by-century'. WAJIB throw Error ber-index: records bukan array; entri bukan objek; familyId bukan string; familyId string kosong; marriageDate tipe salah (bukan string dan bukan null); marriageDate format bukan YYYY-MM-DD; bulan 00 atau 13; tanggal tidak valid kalender; 29 Feb non-kabisat; childIds bukan array; elemen childIds bukan string.
7. familyId duplikat TIDAK didedupe: semua entri tetap dihitung (konsisten v344 v346 v347).
8. Deterministik: akumulasi families dan children per abad di Map, urut ASC numerik. Urutan input tidak memengaruhi output. Nihil randomness, nihil Date, nihil I/O di jalur data.
9. PURE: dilarang import server/, prisma, fetch, fs, path. Murni transformasi. PURE CORE: nihil kode komersial.

## Test vitest: minimal 16 kasus, wajib mencakup
- Distribusi dasar multi abad ASC, average benar (mis. 2 keluarga 3 dan 5 anak = 4; 1 keluarga 1 dari 3 anak = 0.33).
- Urutan input diacak, output identik.
- Abad tunggal; input kosong (semua 0, undated 0).
- Semua marriageDate null (hanya undated).
- Campuran dated dan undated.
- Keluarga childless (childIds []) masuk denominator, average turun.
- familyId duplikat tetap dihitung dua kali.
- Boundary abad 1900 dan 1999 masuk '1900', 2000 pindah '2000'.
- Tahun batas 4 digit (0001 abad 0 label '0', 9999 abad 9900).
- Throw: records bukan array, entri bukan objek, familyId kosong, marriageDate tipe salah, marriageDate format salah, bulan 00 dan 13, 31 Feb, 29 Feb non-kabisat, childIds bukan array, elemen childIds bukan string.

## Gates QA (semua wajib rc 0 / lulus)
- npm ci rc 0.
- vitest dedikasi src/lib/stats/average-family-size-by-century.test.ts lulus penuh.
- npm run build rc 0. npx tsc --noEmit rc 0.
- npx eslint kedua file rc 0. Em dash 0 di seluruh berkas.
- Scope TEPAT 3 berkas vs 5947469: kontrak ini + modul + test. Lockfile NIHIL berubah.

## PROSES WAJIB
- Kerjakan di cabang improve/stg-v371-avg-family-size-century (kontrak ini komit pertama).
- Commit granular: komit modul, komit test (atau gabung wajar). Push origin SEGERA setiap komit (push per komit, pola v364).
- Sebelum selesai: git fetch origin && git merge origin/develop ke cabang, resolve konflik bila ada, push.
- DILARANG merge ke develop, main, atau staging. Merge dilakukan PM setelah QA.
- Lapor akhir: repo, daftar file diubah, output gates, nama cabang, tip commit.
