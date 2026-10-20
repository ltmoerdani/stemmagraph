# KONTRAK v324-STG-MULTIPLE-BIRTH-RATE FASE I (PM: Ardi, 20 Okt 2026)

## Identitas
- Project: Stemmagraph | Item: v324 | Cabang: improve/stg-v324-multiple-birth-rate (dari origin/develop b73e677)
- Sumber: derivasi PM langsung dari jangkar webtrees-statistics (inventaris wt_statistic.php), inline pilar 2 (statistik demografis genealogi) VISION-stemmagraph.
- Jangkar: getMultipleBirthRateByCentury wt_statistic.php baris 1009, doc comment resmi: one LineChart series per multiplicity (twins/triplets/quadruplets/quintuplets+), per-century share of dated births, deteksi sibling satu FAM dengan BIRT berjarak <= 1 hari.
- Anti-dup: grep twin/multiplebirth/multiple-birth NIHIL di src/lib dan server (satu-satunya match 'twin' adalah 'between' di 3 berkas tak terkait); nihil v324 di drafts dan GOAL_HISTORY. Beda substantif dari children-per-family (v287, hitungan anak) dan sibling-age-gap (belum ada modulnya).

## Scope (ADD-ONLY, 2 berkas baru + kontrak ini)
- src/lib/stats/multiple-birth-rate.ts (modul PURE, tanpa import server/, tanpa prisma, tanpa fetch)
- src/lib/stats/multiple-birth-rate.test.ts (vitest dedikasi)

## Spesifikasi perilaku
1. Input: array FamilyBirthGroup { familyId: string, births: { birthYear: number|null, birthMonth: number|null, birthDay: number|null }[] }. Parser strict pola v308-v323: payload bukan array, elemen bukan objek, familyId bukan string, births bukan array, field tanggal bukan number/null => LEMPAR Error dengan nama field dan indeks. Tanggal parsial null SAH.
2. Pairwise dalam satu family: dua birth dianggap multiple birth jika keduanya tanggal lengkap (year+month+day non-null) DAN selisih hari absolut <= 1 hari (deteksi lintas tengah malam, konsisten doc comment jangkar). Selisih hari dihitung via tahun-bulan-hari tanpa zona waktu (konversi ke jumlah hari proleptic Gregorian sederhana: gunakan Date.UTC, deterministik).
3. Kelompok multiplicity: konektivitas transitif dalam satu family (anak A-B kembar dan B-C kembar => triplet A-B-C), multiplicity = ukuran kelompok >= 2.
4. Kohort abad dari tahun lahir kelompok: floor(birthYear/100)*100, label "<start>-<start+99>". Semua anggota kelompok wajib satu abad; jika lintas abad (31 Des vs 1 Jan tahun baru) pakai abad anggota PERTAMA (deterministik, ditetapkan kontrak).
5. Output MultipleBirthRatePayload { centuries: { start, label }[], series: { multiplicity: number, cells: { centuryStart, sharePct (round 1 desimal), count }[] }[], totalBirths, datedBirths, multipleBirths }. series hanya multiplicity yang benar-benar terjadi, urut multiplicity ascending; cells hanya abad berhitungan > 0, urut centuryStart ascending. sharePct = count / datedBirths di abad itu * 100.
6. Input kosong / nihil kelompok: payload utuh tanpa throw. Deterministik: tidak ada jam sistem, tidak ada randomness, urutan input tidak mengubah output (agregasi per kunci).

## Gates (mirror v323)
- npm ci (JANGAN ubah lockfile); npm run build rc 0; npx tsc --noEmit 0; npx eslint pada 2 berkas baru rc 0; em dash 0 di seluruh diff.
- Vitest dedikasi lulus penuh; minimal 14 kasus meliputi: pasangan kembar tepat 0 dan 1 hari, 2 hari GUGUR, lintas tengah malam 31 Des ke 1 Jan, triplet transitif, parser strict throw (5 bentuk), tanggal parsial dihitung undated, sharePct pembulatan, multi-abad, multiplicity 4, determinisme urutan input, input kosong.

## ATURAN GIT WAJIB
1. git checkout develop && git pull origin develop (harus b73e677).
2. git checkout -b improve/stg-v324-multiple-birth-rate.
3. Kerjakan sesuai spesifikasi ini, commit granular, push origin cabang.
4. Sebelum selesai: git merge develop ke cabang, resolve konflik bila ada, push.
5. DILARANG merge sendiri ke develop dan DILARANG push main/staging (pelanggaran v318-v320 tercatat di BOARD). Lapor: repo, berkas diubah, hasil gates, nama cabang. Komit dini (menit 5-10) agar progres terpantau.
