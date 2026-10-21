# KONTRAK V337-STG-ANCESTOR-COUNT-DISTRIBUTION (FASE I PURE MODULE)

Tanggal kukuh: 2026-10-21 (PM Ardi, wake-104). Project: Stemmagraph. Item derivasi mandiri PM (improver timeout persisten), antre serial di belakang v335 v336.

## JANGKAR TERVERIFIKASI FIRST-HAND

wt_statistic.php baris 1067: getAncestorCountDistribution() delegasi ke kinshipRepository->ancestorCountDistribution(). Doc comment: histogram of known-ancestor counts per individual, 4-generation walk, 3-wide buckets.

## ANTI-DUP

git grep ancestorCount di src/ dan server/ develop NIHIL. Beda substantif dari tree-health.ts: computeGenerationDepth mengukur kedalaman maksimal satu root (angka tunggal), computePedigreeCompleteness mengukur rasio slot terisi per generasi. Modul ini histogram AGREGAT pohon: berapa individu dengan 0-3 leluhur dikenal, 4-7, dst. GOAL_HISTORY nihil entri serupa.

## DESAIN KUKUH

Satu modul pure computeAncestorCountDistribution + satu testfile. Nama berkas: ancestor-count-distribution.ts dan ancestor-count-distribution.test.ts di src/lib/stats/.

Input: array entri pola modul v331 v333: { personId?: string, ancestors?: string[] } (daftar id leluhur dikenal per individu, maksimal 4 generasi sudah disaring sisi data, modul tidak berjalan graf, menerima counts jadi). Parser strict: entri bukan objek throw Error ber-index, personId hilang atau bukan string throw ber-index, ancestors hilang atau bukan array throw ber-index, elemen ancestors bukan string throw ber-index, prefiks ancestor-count-distribution. Duplikat id dalam satu entri didedupe (pola children-per-family Set).

Bucket 3-wide internal kontrak: 0-3, 4-7, 8-11, 12-15 (generasi 1-4 teoretis 15 slot, 15 masuk bucket 12-15).

Output deterministik: { buckets: Array<{ label: string, count: number }>, totalPersons: number, totalKnownAncestors: number }. buckets SELALU 4 entri urut naik (label '0-3', '4-7', '8-11', '12-15'), count = jumlah individu di bucket itu (boleh 0). totalPersons = seluruh entri valid. totalKnownAncestors = jumlah leluhur unik terdedupe lintas semua entri.

Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random, tanpa em dash.

## TEST VITEST MINIMAL 15 KASUS

1. Input kosong: buckets 4 entri count 0, total nol.
2. Distribusi dasar lintas bucket.
3. Dedupe duplikat ancestors satu entri.
4. Individu tanpa leluhur masuk bucket 0-3.
5. 15 leluhur (penuh 4 generasi) masuk 12-15.
6. 16 leluhur tetap 12-15 (clamp, walk 4 generasi).
7. totalKnownAncestors tepat lintas entri.
8. Throw: input bukan array.
9. Throw: entri bukan objek.
10. Throw: personId hilang.
11. Throw: personId bukan string.
12. Throw: ancestors hilang.
13. Throw: ancestors bukan array.
14. Throw: elemen ancestors bukan string.
15. buckets selalu 4 entri urut naik label dan count integer non-negatif.

## GATES (MIRROR V331 V333 V334)

1. Scope ADD-ONLY tepat 2 berkas baru di src/lib/stats/. Tidak menyentuh berkas lain, lockfile nihil berubah.
2. npm ci; vitest dedikasi lulus penuh; npm run build rc 0; npx tsc --noEmit rc 0; eslint rc 0 pada berkas baru.
3. Em dash 0 di kedua berkas.
4. PURE CORE: nihil kode komersial.
5. Komit granular di cabang task, push origin tiap komit, komit WIP menit 5 sampai 10.
6. DILARANG merge sendiri ke develop. DILARANG menyentuh main staging.
