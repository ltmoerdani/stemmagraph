# KONTRAK V370-STG-DIVORCE-RATE-BY-MARRIAGE-COHORT FASE I (2026-10-23, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v370-divorce-rate-cohort (DARI origin/develop 3c5d6f2). Base: 3c5d6f2.

## Jangkar (terverifikasi first-hand wake-130)
- webtrees wt_statistic.php getDivorceRateByMarriageCohort() baris 950 sampai 952: delegasi DivorceRepository::divorceRateByMarriageCohort(), return array<int, float> (tab Family, tingkat perceraian per kohort pernikahan).
- Konteks metodologi evidence Sena wake-129 (notes/2026-10-23-wake129-evidence-stg-v370-divorce-cohort.md): ONS cohort first-hand, denominator kohort MARR, unit rate per kohort; Eurostat crude rate hanya sanity check, beda unit.
- Simetris dengan v347 divorces-by-century (event perceraian per keluarga) dan pola bucketing dekade v352/v369 floor(year/10)*10.
- BEDA UNIT dari modul existing: v347 count absolut per abad, v355 age-at-divorce umur saat cerai, v328 survival-cohort-century kohort abad KELAHIRAN.
- Anti-dup BERSIH first-hand wake-130: git grep divorce-rate-by-marriage-cohort dan divorceRateByMarriageCohort NIHIL di origin/develop, nihil di GOAL_HISTORY dan drafts.

## Deliverable: modul PURE src/lib/stats/divorce-rate-by-marriage-cohort.ts + test vitest

1. Input: computeDivorceRateByMarriageCohort(records), satu entri PER KELUARGA:
   { familyId: string; marriageDate: string | null; divorceDate: string | null }
2. marriageDate null = keluarga tanpa tanggal pernikahan terverifikasi: SAH, masuk penghitung undated, BUKAN error, TIDAK masuk denominator kohort.
3. divorceDate null pada keluarga bertanggal pernikahan = keluarga bertahan: masuk denominator (married), bukan pembilang (divorced).
4. Kohort = dekade pernikahan, floor(tahun / 10) * 10, label string '1950', '1960', dst.
5. Output:
   - cohorts: array { cohort: string, married: number, divorced: number, rate: number } urut ASC numerik, hanya kohort dengan married >= 1;
   - rate = divorced / married dibulatkan 2 desimal (pola survivalFraction v328);
   - totalMarried: jumlah married semua kohort;
   - totalDivorced: jumlah divorced semua kohort;
   - undated: jumlah marriageDate null.
6. divorceDate TANPA marriageDate pada entri yang sama: throw Error ber-index (perceraian tanpa pernikahan tidak valid untuk kohort).
7. divorceDate sebelum marriageDate: throw Error ber-index (konsistensi kronologis; di sini dua tanggal dibandingkan satu entri).
8. Parser strict ber-index pola v339/v344/v346/v347, prefiks 'divorce-rate-by-marriage-cohort'. WAJIB throw Error ber-index (bukan filter diam): records bukan array; entri bukan objek; familyId bukan string; familyId string kosong; marriageDate tipe salah (bukan string dan bukan null); divorceDate tipe salah; format bukan YYYY-MM-DD; bulan di luar 1 sampai 12 termasuk 00 dan 13; tanggal tidak valid kalender (31 Feb, 31 April, dst); 29 Feb pada tahun non-kabisat (untuk kedua tanggal).
9. familyId duplikat TIDAK didedupe: semua entri tetap dihitung (konsisten v344 v346 v347).
10. Deterministik: akumulasi married dan divorced per kohort di Map, lalu urut ASC numerik. Urutan input tidak memengaruhi isi output. Nihil randomness, nihil jam sistem, nihil I/O di jalur data.
11. PURE: dilarang import server/, prisma, fetch, fs, path. Murni transformasi array menjadi angka. PURE CORE: nihil kode komersial billing/premium/paywall/subscription.

## Test vitest: minimal 16 kasus, wajib mencakup
- Distribusi dasar multi kohort dekade, urut ASC.
- Urutan input diacak, output identik.
- Kohort tunggal; input kosong (cohorts [], totalMarried 0, totalDivorced 0, undated 0).
- Semua marriageDate null (hanya undated).
- Campuran dated, undated, dan bertahan (divorceDate null masuk denominator).
- familyId duplikat tetap dihitung dua kali.
- Rate benar: 1 dari 4 = 0.25; 1 dari 3 = 0.33 (pembulatan 2 desimal).
- Kohort rate 0 dan kohort rate 1.
- divorceDate tanpa marriageDate throw.
- divorceDate sebelum marriageDate throw.
- Throw ber-index: records bukan array, entri bukan objek, familyId kosong, marriageDate tipe salah, marriageDate format salah, divorceDate tipe salah, divorceDate format salah.
- Bulan 00 dan 13 throw (kedua tanggal).
- 29 Feb kabisat SAH, 29 Feb non-kabisat throw.
- Tanggal kalender invalid throw (31 Feb, 31 April).
- Dekade boundary: 1900 dan 1909 masuk '1900', 1910 pindah '1910'.
- Tahun batas 4 digit (0001 masuk dekade 0 label '0', 9999 masuk dekade 9990).

## Gates QA (semua wajib rc 0 / lulus)
- npm ci rc 0.
- vitest dedikasi src/lib/stats/divorce-rate-by-marriage-cohort.test.ts lulus penuh.
- npm run build rc 0. npx tsc --noEmit rc 0.
- npx eslint kedua file rc 0. Em dash 0 di seluruh berkas.
- Scope TEPAT 3 berkas vs 3c5d6f2: kontrak ini + modul + test. Lockfile NIHIL berubah.

## PROSES WAJIB
- Kerjakan di cabang improve/stg-v370-divorce-rate-cohort (kontrak ini komit pertama).
- Commit granular: komit modul, komit test (atau gabung wajar). Push ke origin SEGERA setiap komit (push per komit, pola v364).
- Sebelum selesai: git merge develop ke cabang, resolve konflik bila ada, push.
- DILARANG merge ke develop, DILARANG merge cabang lain, DILARANG menyentuh main, staging, atau develop. Merge dilakukan PM setelah QA.
- Lapor akhir: repo, daftar file diubah, output gates, nama cabang, tip commit.
