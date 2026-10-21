# KONTRAK V336-FIX-STG-DEATHS-BY-COUNTRY (PERBAIKAN QA)

Tanggal: 2026-10-21 (PM Ardi). Project: Stemmagraph.

LATAR: v336 fase i merged ed43812 TAPI QA R1 PM GAGAL substansi: modul 43 baris dan test 2 kasus jauh di bawah standar antrean (pembanding v332 116 baris 18 kasus, v333 119 baris 17 kasus), parser TIDAK strict, negara memakai seluruh deathPlace bukan token terakhir koma, eslint error no-explicit-any baris 3. Fix = rewrite penuh 2 berkas di cabang baru.

SCOPE: TEPAT 2 berkas rewrite: src/lib/stats/deaths-by-country.ts dan src/lib/stats/deaths-by-country.test.ts. Tidak menyentuh berkas lain, lockfile nihil berubah.

DESAIN:
- Input: array entri { deathDate?: { date?: string }, deathPlace?: string }.
- Parser strict pola v332 v334: input bukan array LEMPAR Error ber-index prefiks deaths-by-country, entri bukan objek LEMPAR, deathDate ada tapi bukan objek LEMPAR, deathDate.date ada tapi bukan string LEMPAR, deathPlace ada tapi bukan string LEMPAR.
- Kebijakan dated-only: entri dihitung hanya jika deathDate.date string non-kosong setelah trim DAN deathPlace non-kosong setelah trim; sisanya excludedNoPlace.
- Negara = token TERAKHIR setelah koma deathPlace, trim lalu lowercase; tanpa koma: seluruh string.
- Output: { items: Array<{ label; count }>, totalDated, excludedNoPlace }; items hanya count > 0; urut count desc tie label asc alphabetical.
- Typed interface eksplisit, NOL any (eslint no-explicit-any wajib bersih).
- Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.

TEST VITEST MINIMAL 15 KASUS: multi-koma token terakhir, tanpa koma, lowercase, trim spasi, count agregat dan urutan desc tie alphabetical, totalDated dan excludedNoPlace tepat, input kosong, throw semua bentuk salah, deathDate tanpa date, date string kosong, deathPlace string kosong.

GATES: vitest dedikasi lulus; npm run build rc 0; npx tsc --noEmit rc 0; npx eslint rc 0 pada kedua berkas; em dash 0; scope 2 berkas; komit granular push origin tiap komit; komit WIP menit 5 sampai 10; DILARANG merge sendiri ke develop; DILARANG sentuh main staging.

Cabang existing: improve/stg-v336-fix-deaths-by-country di origin, basis ed43812. JANGAN buat cabang baru.
