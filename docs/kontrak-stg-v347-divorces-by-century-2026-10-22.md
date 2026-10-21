# KONTRAK V347-STG-DIVORCES-BY-CENTURY FASE I (2026-10-22, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v347-divorces-by-century (DARI origin/develop ffe4996). Base: ffe4996.

## Jangkar (terverifikasi first-hand)
- webtrees Statistic.php getDivorcesByCentury() baris 913 sampai 916: delegasi DivorceRepository::divorcesByCentury(), return array<int,int> abad => count (tab Family, distribusi perceraian per abad).
- Simetris langsung dengan v346 weddings-by-century (merged ffe4996, eventsByCentury MARR): v347 memakai event perceraian keluarga. BEDA EVENT dan BEDA UNIT dari divorces-by-month v341 (bulan, per personId).
- Anti-dup BERSIH first-hand: git grep divorcesByCentury / divorces-by-century nihil di origin/develop, nihil di GOAL_HISTORY dan drafts.

## Deliverable: modul PURE src/lib/stats/divorces-by-century.ts + test vitest

Mirror penuh pola v346 weddings-by-century yang sudah merged:

1. Input: computeDivorcesByCentury(records), satu entri PER KELUARGA:
   { familyId: string; divorceDate: string | null }
2. divorceDate null = keluarga tanpa tanggal perceraian terverifikasi: SAH, masuk penghitung undated, BUKAN error.
3. Abad = floor(tahun / 100) * 100, label string '1500', '1600', dst.
4. Output:
   - centuries: array { century: string, count: number } urut ASC numerik, hanya abad dengan count >= 1;
   - total: jumlah count semua abad;
   - undated: jumlah divorceDate null.
5. Parser strict ber-index pola v339/v344/v346, prefiks 'divorces-by-century'. WAJIB throw Error ber-index (bukan filter diam): records bukan array; entri bukan objek; familyId bukan string; familyId string kosong; divorceDate tipe salah (bukan string dan bukan null); format bukan YYYY-MM-DD; bulan di luar 1 sampai 12 termasuk 00 dan 13; tanggal tidak valid kalender (31 Feb, 31 April, dst); 29 Feb pada tahun non-kabisat.
6. familyId duplikat TIDAK didedupe: semua entri tetap dihitung (konsisten v344 v346).
7. Deterministik: akumulasi count per century di Map, lalu urut ASC numerik. Urutan input tidak memengaruhi isi output. Nihil randomness, nihil jam sistem, nihil I/O di jalur data.
8. PURE: dilarang import server/, prisma, fetch, fs, path. Murni transformasi array menjadi angka. PURE CORE: nihil kode komersial.

## Test vitest: minimal 15 kasus, wajib mencakup
- Distribusi dasar multi-abad, urut ASC.
- Urutan input diacak, output identik.
- Abad tunggal; input kosong (centuries [], total 0, undated 0).
- Semua null (hanya undated).
- Campuran dated dan undated.
- familyId duplikat tetap dihitung dua kali.
- Lima bentuk throw ber-index (records bukan array, entri bukan objek, familyId kosong, divorceDate tipe salah, format salah).
- Bulan 00 dan 13 throw.
- 29 Feb kabisat SAH, 29 Feb non-kabisat throw.
- Tanggal kalender invalid throw (31 Feb, 31 April).
- Tahun batas 4 digit (0001 masuk abad 0 dengan label '0', 9999 masuk abad 9900).

## Gates QA (semua wajib rc 0 / lulus)
- npm ci rc 0.
- vitest dedikasi src/lib/stats/divorces-by-century.test.ts lulus penuh.
- npm run build rc 0. npx tsc --noEmit rc 0.
- npx eslint kedua file rc 0. Em dash 0 di seluruh berkas.
- Scope TEPAT 3 berkas vs ffe4996: kontrak ini + modul + test. Lockfile NIHIL berubah.

## PROSES WAJIB
- Kerjakan di cabang improve/stg-v347-divorces-by-century (kontrak sudah terkomit sebagai komit pertama).
- Commit granular: komit modul, komit test (atau gabung wajar), push ke origin cabang yang sama.
- DILARANG merge ke develop, DILARANG merge cabang lain, DILARANG menyentuh main, staging, atau develop. Merge dilakukan PM setelah QA.
- Lapor akhir: repo, daftar file diubah, output gates, nama cabang, tip commit.
