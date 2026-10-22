# KONTRAK V363-STG-TOP-SURNAMES FASE I (2026-10-22, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v363-top-surnames (DARI origin/develop b83a8c8). Base: b83a8c8.

## Jangkar (pola terverifikasi seri)
- magicsunday/webtrees-statistics TopSurnamesRepository (keluarga modul sama dengan given-name-trends v311 yang sudah merged; jangkar keluarga wt_statistic.php yang dipakai v360/v361/v362). Frekuensi marga/nama keluarga.
- Mirror input pola v311 given-name-trends yang sudah merged: satu entri PER ORANG { birthDate, surname }.
- Anti-dup BERSIH first-hand 22 Okt: git grep top-surnames / topSurnames / surname-frequency nihil di origin/develop (surname-marriage-matrix BEDA fungsi: matriks pasangan marga, bukan frekuensi tunggal).

## Deliverable: modul PURE src/lib/stats/top-surnames.ts + test vitest

1. Input: computeTopSurnames(members, opts?), satu entri per orang { birthDate, surname }.
2. birthDate strict YYYY-MM-DD pola v311: format salah, tanggal tidak valid kalender (termasuk 29 Feb non-kabisat) DILEMPAR Error ber-prefiks 'top-surnames'. birthDate WAJIB valid (beda dari modul birth-optional: saringan frekuensi dianchored dekade).
3. surname dinormalisasi: trim, lowercase, aksen dihapus (normalize NFD, strip range Mn), tanda baca dihapus. Hasil kosong atau placeholder @P.N. dibuang (orang itu gugur dari frekuensi, TANPA error).
4. Output { surnames: [{ surname, count }], totalSurnames, window: { decade: string, count: number } | null }:
   - surnames urut count DESC, tie alfabetis ASC, dipotong topN (default 10, clamp 1 sampai 50);
   - totalSurnames = jumlah marga unik valid SEBELUM pemotongan;
   - window = dekade dengan frekuensi marga tertinggi agregat (floor(tahun/10)*10, label '1970s' dst), tie dekade lebih awal menang; null saat input kosong valid.
5. Deterministik: agregasi Map per kunci lalu sortir. Nihil randomness, nihil jam sistem, nihil I/O di jalur data.
6. PURE: dilarang import server/, prisma, fetch, fs, path. PURE CORE: nihil kode komersial.

## Test vitest: minimal 16 kasus, wajib mencakup
- Input kosong: surnames [], totalSurnames 0, window null.
- Distribusi dasar multi-marga urut count DESC.
- Tie count = alfabetis ASC.
- topN default 10; clamp topN 0 menjadi 1; clamp topN 999 menjadi 50.
- Normalisasi: trim + case fold; aksen (mis. 'Símǎ' jadi 'sima'); tanda baca dihapus; @P.N. gugur; hasil kosong gugur.
- birthDate invalid format (mis. '1970-13-01', 'abc') throw Error prefiks top-surnames.
- birthDate kalender invalid ('1970-02-30', '1971-02-29') throw.
- birthDate null/tipe salah throw (kontrak anchored strict).
- window: dekade agregat tertinggi; tie pilih dekade lebih awal; semua-valid memastikan window non-null.
- Determinisme: dua urutan input hasil identik.

## Gates (mirror seri v311 sampai v362)
- vitest standalone >= 16/16; regresi src/lib/genealogy 2106/2106 (158 file); npm run build rc 0; tsc rc 0; eslint rc 0 kedua berkas; em dash 0 di diff; scope TEPAT 2 berkas baru; lockfile nihil tersentuh.
- Komit granular (modul dulu, test lalu); DILARANG merge sendiri; lapor repo + branch + hash.
