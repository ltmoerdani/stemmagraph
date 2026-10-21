# KONTRAK V338-STG-BIRTHS-BY-COUNTRY (FASE I)

Tanggal: 2026-10-21 (PM Ardi). Project: Stemmagraph.

LATAR: Antrean serial kosong pasca v337 merged 8cf9b5d ke develop. Kandidat ini turunan PM dari VISION Stemmagraph (statistik silsilah open source, jangkar webtrees). Jangkar: wt_statistic.php getBirthsByCountry baris 414 (event tag BIRT). Pasangan langsung deaths-by-country v336-fix QA R2 lulus (6459246, merge ba1e7b5). Anti-dup PM first-hand 21 Okt: grep origin/develop nihil modul births-by-country atau birthsByCountry di src/, bersih.

SCOPE: TEPAT 2 berkas BARU: src/lib/stats/births-by-country.ts dan src/lib/stats/births-by-country.test.ts. Tidak menyentuh berkas lain, lockfile nihil berubah.

DESAIN (mirror v336-fix yang lulus QA R2, ganti bidang birth):
- Input: array entri { birthDate?: { date?: string }, birthPlace?: string }.
- Parser strict pola v332 v334 v336-fix: input bukan array LEMPAR Error ber-index prefiks births-by-country, entri bukan objek LEMPAR, birthDate ada tapi bukan objek LEMPAR, birthDate.date ada tapi bukan string LEMPAR, birthPlace ada tapi bukan string LEMPAR.
- Kebijakan dated-only: entri dihitung hanya jika birthDate.date string non-kosong setelah trim DAN birthPlace non-kosong setelah trim; sisanya excludedNoPlace.
- Negara = token TERAKHIR setelah koma birthPlace, trim lalu lowercase; tanpa koma: seluruh string.
- Output: { items: Array<{ label: string; count: number }>, totalDated: number, excludedNoPlace: number }; items hanya count > 0; urut count desc, tie label asc alphabetical (localeCompare lowercase).
- Typed interface eksplisit, NOL any (eslint no-explicit-any wajib bersih).
- Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.

TEST VITEST MINIMAL 15 KASUS: multi-koma token terakhir, tanpa koma, lowercase, trim spasi, agregat count dan urutan desc tie alphabetical, totalDated dan excludedNoPlace tepat, input kosong, throw semua lima bentuk salah termasuk cek prefiks via regex, birthDate tanpa date, date string kosong, birthPlace string kosong.

GATES: vitest dedikasi lulus; npm run build rc 0; npx tsc --noEmit rc 0; npx eslint rc 0 pada kedua berkas; em dash 0; scope 2 berkas; komit granular push origin tiap komit; komit WIP paling lambat menit 10; DILARANG merge sendiri ke develop; DILARANG sentuh main dan staging.

CABANG: improve/stg-v338-births-by-country, dibuat PM dari origin/develop 8cf9b5d, kontrak ini sudah dikomit dan dipush di cabang. JANGAN buat cabang baru, checkout cabang existing dan pull origin.
