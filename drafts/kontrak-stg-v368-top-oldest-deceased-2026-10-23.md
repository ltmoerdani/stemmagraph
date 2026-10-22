# KONTRAK STG-V368-TOP-OLDEST-DECEASED (FASE I, PURE)

Tanggal kukuh: 23 Okt 2026, 02:0x WIB (PM Ardi, wake-130)
Project: Stemmagraph. Item vision: statistik pohon (pilar riset 4, arsip jangkar webtrees-statistics).
Status: fase i modul pure tanpa I/O, tanpa wiring UI. Pola mirror v301 oldest-living.
Catatan anti-dup: kandidat lama cumulative-births-by-decade GUGUR wake-130, sudah tercover v352 (computeCumulativeBirthsByDecade di births-by-decade.ts, verifikasi first-hand PM). top-oldest-deceased nihil di develop (git grep oldest-deceased/OldestDeceased/topOldestDeceased = kosong). age-at-death.ts = distribusi umur, beda fungsi dari ranking ini.

## JANGKAR (terverifikasi first-hand PM wake-130)

Modul rujukan: magicsunday/webtrees-statistics wt_statistic.php baris 783:
- getTopOldestDeceased(int $limit): array, Top-N anggota meninggal tertua, tiap baris XREF, display name, umur dalam tahun penuh. Repository: lifeSpanRepository::topOldestDeceased.
- Rujukan pola, bukan salinan kode.

## SCOPE (2 berkas baru saja)

1. src/lib/stats/top-oldest-deceased.ts
2. src/lib/stats/top-oldest-deceased.test.ts

DILARANG menyentuh berkas lain. DILARANG merge sendiri ke develop.

## SPESIFIKASI

- Nama fungsi: computeTopOldestDeceased(members, topN = 10).
- Input abstrak: array entri { id: string, birthDate: string | null, deathDate: string | null, isAlive: boolean }.
- Kandidat: isAlive false DAN birthDate terparse valid DAN deathDate terparse valid. Entri dengan birthDate atau deathDate null, format salah, atau tanggal kalender invalid DIKECUALIKAN tanpa throw (konsisten pola v301 oldest-living).
- Parser strict YYYY-MM-DD pola v301: regex 4-2-2 digit, validasi kalender Gregorian termasuk kabisat (1900-02-29 ditolak, 2000-02-29 valid), trim, tanpa fallback format lain.
- Umur kematian = tahun penuh anniversary-aware antara lahir dan meninggal: death.y - birth.y, dikurangi 1 bila ulang tahun belum tercapai pada tanggal kematian; ulang tahun tepat tanggal kematian = usia baru tercapai. Komponen tanggal dibaca dari hasil parser lokal (bukan Date), jadi bebas zona waktu.
- Urutan: ageYears DESC, tie birthDate ASC (lebih tua lahir duluan), lalu id ASC leksikograf.
- topN default 10; topN <= 0 menghasilkan array kosong; topN memotong hasil.
- Output: Array<{ id: string, ageYears: number }>.
- Deterministik: nihil randomness, nihil Date.now/new Date di jalur data (tidak butuh parameter now karena rentang lahir-meninggal self-contained). Tanpa import apa pun, tanpa I/O, tanpa fetch, nihil dependency baru. Add-only.
- PURE CORE: dilarang kode komersial apa pun.

## TEST (vitest, dedikasi, minimal 14 kasus)

1. Array kosong menghasilkan array kosong tanpa throw.
2. Satu entri meninggal valid: satu baris id + ageYears benar.
3. Peringkat ageYears DESC meski input acak.
4. topN memotong hasil.
5. topN = 0 dan topN negatif menghasilkan array kosong.
6. Entri isAlive true dikecualikan.
7. birthDate null dikecualikan; deathDate null dikecualikan.
8. Format invalid (abc, 1952/03/10, 1952-3-10) dikecualikan tanpa throw.
9. Tanggal kalender invalid dikecualikan: 1900-02-29 ditolak, 2000-02-29 valid.
10. Tie ageYears: urut birthDate ASC.
11. Tie ageYears dan birthDate: urut id ASC leksikograf.
12. Anniversary tepat tanggal kematian: usia baru tercapai (mis. lahir 1950-03-10, meninggal 2020-03-10, umur 70).
13. Ulang tahun belum lewat pada tanggal kematian: usia minus satu.
14. Umur 0: lahir dan meninggal tahun sama sebelum ulang tahun.
15. Determinisme: dua urutan input berbeda menghasilkan output identik.

## GIT (WAJIB)

1. git checkout develop && git pull origin develop di /home/zeroclaw/projects/stemmagraph
2. Buat branch improve/stg-v368-top-oldest-deceased DARI develop
3. Kerjakan sesuai AC, commit granular, PUSH per komit ke origin
4. Sebelum selesai: git merge develop ke branch, resolve konflik, push
5. Lapor: repo, nama branch, file diubah, hasil verifikasi lokal
