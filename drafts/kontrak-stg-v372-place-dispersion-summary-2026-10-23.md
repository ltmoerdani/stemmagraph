# Kontrak Stemmagraph v372 fase i: place-dispersion-summary

Tanggal: 23 Okt 2026 (wake-132). Penulis: PM Ardi. Eksekutor: fullstack (Raka). Cabang: improve/stg-v372-place-dispersion-summary dari develop 4fc41c9. DILARANG merge sendiri.

## Item

Modul PURE statistik place dispersion: sebaran jumlah nilai PLAC berbeda per orang, pilar statistik Places VISION-stemmagraph. Mirror jangkar webtrees-statistics wt_statistic.php baris 589 dispersionSummary() yang mendelegasikan PlaceDispersionRepository::dispersionSummary().

## Jangkar first-hand (akses PM 23 Okt 2026, raw.githubusercontent.com/magicsunday/webtrees-statistics/main/src/Repository/PlaceDispersionRepository.php)

1. Output repository: PlaceDispersionSummary { average, sampled, distribution }.
2. distribution bucket kunci "1", "2", "3", "4", "5+" (DISTRIBUTION_MAX = 5; distinct >= 5 masuk "5+").
3. Orang tanpa nilai PLAC berbeda (distinct = 0) dikeluarkan diam-diam dari sampled dan distribusi (tidak menarik average ke nol).
4. average = round(totalPlaces / sampled, 2); sampled = 0 menghasilkan 0.0.
5. distinct = count(array_unique(trim, non-kosong)); pembandingan case-sensitive (Berlin dan berlin dihitung dua).
6. Semua bucket pre-seed 0 supaya sumbu kontinu walau ada bucket kosong.

## Adaptasi Stemmagraph (pola fase i modul pure, rujukan pola bukan salinan kode)

Input daftar entri SATU per orang: { personId: string; places: string[] }. places adalah kumpulan nilai PLAC level-1 dari seluruh event orang itu (parsing GEDCOM bukan scope modul ini).

## AC

1. computePlaceDispersionSummary(entries) murni: tanpa import server/, tanpa prisma, tanpa fetch, tanpa Date, tanpa I/O, deterministik terhadap urutan input.
2. Dedup nilai tempat per orang: trim dulu, string kosong atau whitespace-only di-skip sah (bukan error, konsisten perilaku skip PHP), dedup case-sensitive via Set.
3. Orang dengan distinct = 0 dikeluarkan dari sampled, totalPlaces, dan distribution; tetap bukan error.
4. Output: { average, sampled, totalPlaces, distribution }. distribution selalu memuat kelima kunci "1", "2", "3", "4", "5+" berhitungan 0 sebagai dasar (sumbu kontinu). Bucketing: distinct >= 5 masuk "5+", selain itu kunci string(distinct).
5. average = totalPlaces / sampled dibulatkan 2 desimal pola v370/v371; sampled = 0 menghasilkan average 0.
6. Parser strict ber-index prefiks place-dispersion-summary: records bukan array, entri bukan objek, personId bukan string, personId string kosong, places bukan array, elemen places bukan string, semuanya LEMPAR Error ber-index. Duplikat personId lintas entri TIDAK didedupe: semua entri dihitung sebagai sampel terpisah (catatan eksplisit kontrak, konsisten keputusan v371).
7. Test dedikasi vitest minimal 14 kasus: multi orang average dan totalPlaces, determinisme lintas urutan input acak, satu orang, input kosong (sampled 0, average 0, distribution penuh nol), semua orang tanpa places, dedup case-sensitive, trim whitespace, skip string kosong, boundary 4 vs 5 vs 7 (bucket "4", "5+", "5+"), pembulatan 2 desimal, duplikat personId dihitung dua sampel, throw parser per tipe salah (minimal 4 kasus).
8. Gate: npm run build rc 0, npm run lint 0 error di berkas baru, tsc 0, vitest dedikasi lulus penuh standalone, em dash 0 di semua berkas dan pesan komit, scope TEPAT 3 berkas (kontrak + modul + test), lockfile nihil, PURE CORE bersih (nihil isPremium/paywall/billing/subscription).

## Anti-dup (terverifikasi PM 23 Okt 2026)

git grep place-dispersion dan PlaceDispersion di origin/develop: hanya migration-distance v319 (metrik jarak haversine band, unit km, beda substansi) dan draft kontrak v319. Nihil place-dispersion-summary atau varian placeDispersionSummary. Kandidat sah.

## Alur kerja wajib

1. git checkout develop && git pull origin develop.
2. Cabang improve/stg-v372-place-dispersion-summary SUDAH dibuat PM dari 4fc41c9 dan sudah berisi kontrak ini (komit pertama). Lanjutkan di cabang itu, JANGAN buat cabang baru.
3. Komit granular: modul dulu, test kemudian. Push ke origin SETIAP komit (push per komit wajib).
4. Sebelum lapor: git merge develop ke cabang, resolve konflik bila ada, push.
5. Lapor: nama cabang, hash komit, numstat, hasil gate satu per satu. DILARANG merge ke develop sendiri.
