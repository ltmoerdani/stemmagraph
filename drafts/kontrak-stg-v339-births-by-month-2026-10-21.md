# KONTRAK V339-STG-BIRTHS-BY-MONTH (FASE I)

Tanggal: 2026-10-21 (PM Ardi). Project: Stemmagraph.

LATAR: Antre serial pasca v338 births-by-country. Jangkar: wt_statistic.php getBirthsByMonth baris 381 (translateMonthKeys(eventRepository->eventsByMonth('BIRT'))), pasangan simetris death-seasonality v312 (getDeathsByMonth baris 422, sudah merged). Anti-dup PM first-hand 21 Okt: grep births-by-month dan birthsByMonth nihil di src/ dan server/, nihil v339 di GOAL_HISTORY, bersih.

SCOPE: TEPAT 2 berkas BARU: src/lib/stats/births-by-month.ts dan src/lib/stats/births-by-month.test.ts. Tidak menyentuh berkas lain, lockfile nihil berubah.

DESAIN (mirror death-seasonality v312, ganti bidang birth, tanpa winter peak):
- Input: array entri { birthDate: string }.
- Parser strict pola v312: input bukan array LEMPAR Error ber-index prefiks births-by-month; entri bukan objek LEMPAR; birthDate hilang atau bukan string LEMPAR; format bukan YYYY-MM-DD LEMPAR; bulan di luar 1 sampai 12 LEMPAR; tanggal tidak valid secara kalender (termasuk 29 Feb non-kabisat) LEMPAR.
- Output: { birthsByMonth: array 12 angka, indeks 0 = Januari sampai 11 = Desember; total: number; peakMonth: number | null; peakCount: number | null }. peakMonth = indeks bulan count tertinggi, tie pilih indeks terkecil; keduanya null saat total 0 (pola nullable jangkar winter peak).
- Akumulasi per indeks bulan sehingga urutan input tidak memengaruhi output.
- Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
- Typed interface eksplisit, NOL any (eslint no-explicit-any wajib bersih).

TEST VITEST MINIMAL 15 KASUS: distribusi dasar 12 bulan, akumulasi multi-entri, urutan input diacak hasil identik, total tepat, peakMonth tie indeks terkecil, peakMonth dan peakCount null saat total 0, input kosong, throw semua bentuk salah dengan cek prefiks via regex, 29 Feb kabisat valid, 29 Feb non-kabisat throw, bulan 13 throw, format DD-MM-YYYY throw.

GATES: vitest dedikasi lulus; npm run build rc 0; npx tsc --noEmit rc 0; npx eslint rc 0 pada kedua berkas; em dash 0; scope 2 berkas; komit granular push origin tiap komit; komit WIP paling lambat menit 10; DILARANG merge sendiri ke develop; DILARANG sentuh main dan staging.

CABANG: improve/stg-v339-births-by-month, dibuat PM dari origin/develop 8cf9b5d, kontrak ini sudah dikomit dan dipush di cabang. JANGAN buat cabang baru, checkout cabang existing dan pull origin. DISPATCH SERIAL: baru boleh dikerjakan SETELAH v338 closed (aturan 1 task implementasi aktif per project), bukan sekarang.
