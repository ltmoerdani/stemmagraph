# KONTRAK V364-STG-MARRIAGES-BY-DECADE FASE I (2026-10-22, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v364-marriages-by-decade (DARI origin/develop a7e0ae9). Base: a7e0ae9.

## Jangkar (pola terverifikasi seri)
- Mirror langsung v346 weddings-by-century (merged ffe4996): input SAMA PERSIS satu entri per keluarga { familyId, marriageDate: string | null }, bucket dekade (floor(tahun/10)*10) bukan abad. Jangkar deret statistik webtrees distribusi pernikahan per periode.
- Anti-dup BERSIH first-hand 22 Okt: git grep marriages-by-decade / marriagesByDecade / marriage-decade nihil di origin/develop (marriage-age, marriage-duration, marriage-months, weddings-by-century semuanya BEDA fungsi).

## Deliverable: modul PURE src/lib/stats/marriages-by-decade.ts + test vitest

1. Input: computeMarriagesByDecades(records), satu entri PER KELUARGA { familyId: string, marriageDate: string | null }.
2. marriageDate null = tanpa tanggal terverifikasi: SAH, masuk penghitung undated, BUKAN error.
3. Dekade = floor(tahun / 10) * 10, label string '1950s', '1970s', dst.
4. Output:
   - decades: array { decade: string, count: number } urut ASC numerik decadeStart, hanya dekade count >= 1 (pola v328/v346);
   - total: jumlah count semua dekade;
   - undated: jumlah marriageDate null.
5. Parser strict ber-index pola v339/v344/v346, prefiks 'marriages-by-decade'. WAJIB throw Error ber-index (bukan filter diam): records bukan array; entri bukan objek; familyId bukan string; familyId string kosong; marriageDate tipe salah (bukan string dan bukan null); format bukan YYYY-MM-DD; bulan di luar 1 sampai 12 termasuk 00 dan 13; tanggal tidak valid kalender; 29 Feb pada tahun non-kabisat.
6. familyId duplikat TIDAK didedupe: semua entri tetap dihitung (konsisten v344/v346).
7. Deterministik: akumulasi count per decadeStart di Map, lalu urut ASC numerik. Urutan input tidak memengaruhi isi output. Nihil randomness, nihil jam sistem, nihil I/O di jalur data.
8. PURE: dilarang import server/, prisma, fetch, fs, path. Murni transformasi array menjadi angka. PURE CORE: nihil kode komersial.

## Test vitest: minimal 15 kasus, wajib mencakup
- Distribusi dasar multi-dekade urut ASC.
- Urutan input diacak, output identik.
- Dekade tunggal; input kosong (decades [], total 0, undated 0).
- Semua null (decades [], total 0, undated N).
- Batas dekade: 1969 masuk 1960s, 1970 masuk 1970s.
- mixed null dan dated.
- Parser throw: records bukan array; entri bukan objek; familyId bukan string; familyId kosong; marriageDate tipe salah; format salah ('abc', '1970-1-1'); bulan 00 dan 13; 30 Feb; 29 Feb non-kabisat; 29 Feb kabisat TIDAK throw.
- familyId duplikat tetap dihitung dua kali.
- total = jumlah count decades.

## Gates (mirror seri v311 sampai v363)
- vitest standalone >= 15/15; regresi npx vitest run src/lib/genealogy wajib 2106/2106 tetap hijau; npm run build rc 0; npx tsc --noEmit rc 0; npx eslint rc 0 kedua berkas; em dash 0 di diff; scope TEPAT 2 berkas BARU src/lib/stats/marriages-by-decade.ts dan .test.ts, nihil berkas lain tersentuh; lockfile nihil diubah; installer npm ci pola PROJECT.md.
- Komit granular (modul dulu, test lalu); DILARANG merge sendiri; lapor repo + branch + hash.
