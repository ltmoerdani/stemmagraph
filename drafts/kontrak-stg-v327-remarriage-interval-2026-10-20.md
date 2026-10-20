# KONTRAK V327-STG-REMARRIAGE-INTERVAL FASE I (PM Ardi, 20 Okt 2026)

Item: modul pure remarriage interval, jarak bulan antara kematian pasangan dan pernikahan berikutnya survivor, band bulan.

## Jangkar
- wt_statistic.php baris 869 getRemarriageIntervalDistribution delegasi ke marriageRepository->remarriageIntervalDistribution(), doc comment: band bulan kurang dari 6 sampai 60+, months between spouse death and next marriage, sinyal konvensi tahun duk cita.
- Bukan duplikat v325 widowhood interval (kematian pasangan sampai wafat survivor, BUKAN sampai menikah lagi).

## Scope (ADD-ONLY 2 berkas baru)
1. `src/lib/stats/remarriage-interval.ts` modul pure, tanpa import selain tipe StdDate pola v325 boleh didefinisikan ulang lokal.
2. `src/lib/stats/remarriage-interval.test.ts` vitest, minimal 14 kasus.

DILARANG menyentuh berkas lain, dilarang ubah lockfile/package.json.

## Tipe input (pola v325)
- `StdDate` identik divorce-widowhood.ts: { dateKind: string, yearStart, monthStart, dayStart } masing-masing number | null.
- `RemarriageSpouseInput`: { id: string, sex: 'M' | 'F', deathDate: StdDate | null }.
- `RemarriageUnionInput`: { unionId: string, marriageDate: StdDate | null, spouses: RemarriageSpouseInput[] }.

## Spesifikasi perilaku
1. Band bulan penuh: kurang dari 6, 6-11, 12-23, 24-35, 36-47, 48-59, 60+. Label string eksak: '<6', '6-11', '12-23', '24-35', '36-47', '48-59', '60+'.
2. Interval bulan penuh tuple-based antara DEAT pasangan u1 (yang wafat) dan MARR u2: bulan = (y2-y1)*12 + (m2-m1), kurangi 1 bila d2 < d1 (anniversary belum tercapai), minimum 0. Floor, tanpa pembulatan lain.
3. Rantai per person: kumpulkan union tempat person jadi spouse, hanya union ber-MARR EXACT, urutkan berdasar tanggal MARR tuple (tie: urutan input). Untuk tiap pasangan union berurutan u1 lalu u2: survivor = person; syarat spouse lain di u1 punya DEAT EXACT dan DEAT lebih awal dari MARR u2.
4. DEAT non-EXACT atau null: pasangan u1 tidak membentuk interval (rantai tetap lanjut ke u2 dari union sebelumnya yang valid, yakni interval hanya terbentuk antar dua union valid yang berurutan pada person). Jika union di antara dua valid tidak valid, interval tetap dihitung antara union valid sebelumnya dan sesudahnya pada rantai person yang sama.
5. MARR u2 sama atau lebih awal dari DEAT pasangan u1: masuk counter anomalies, TIDAK masuk band, TIDAK gagalkan rantai.
6. Output `RemarriageIntervalPayload`: { bands: Array<{ band: string, count: number }> selalu 7 entri urut kontrak, survivorsTotal (jumlah interval valid masuk band), anomalies, personsWithChains (jumlah person unik yang punya minimal satu interval valid atau anomali) }.
7. Deterministik: tanpa random, tanpa Date, tanpa I/O. Urutan input acak hasil identik (agregasi per kunci band dan Set person).
8. Input kosong atau nihil rantai: hasil nol, TIDAK throw.
9. Parser strict pola v308-v326: payload salah bentuk LEMPAR Error dengan nama field, TANPA silent-filter di parser.

## Test wajib (minimal 14)
Empty; satu union nihil rantai; rantai normal band 6-11; rantai band 60+; dua rantai beda person; MARR non-EXACT gugur dari rantai; DEAT non-EXACT gugur syarat; anomali MARR sebelum DEAT masuk counter; satu person dua rantai beruntun; boundary tepat 6 bulan masuk 6-11 dan tepat 60 bulan masuk 60+; survivorsTotal dan anomalies benar; personsWithChains; urutan input diacak hasil identik; survivor tanpa pernikahan berikutnya nihil.

## Gates (mirror v324-v326)
- `npx vitest run src/lib/stats/remarriage-interval.test.ts` hijau penuh.
- `npm run build` rc 0 (guard pure-core).
- `npx tsc --noEmit` rc 0.
- `npx eslint` scope 2 berkas nihil temuan.
- Em dash 0 seluruh diff. Nihil pattern komersial. Lockfile nihil berubah.

## Proses
- Cabang `improve/stg-v327-remarriage-interval` SUDAH ada di origin (kontrak komit pertama). GUNAKAN cabang ini, JANGAN buat baru.
- Sinkron dulu: `git fetch origin && git checkout improve/stg-v327-remarriage-interval && git merge origin/develop` bila develop maju.
- Komit dini target menit 5 sampai 10. Commit granular. Push tiap komit.
- DILARANG MERGE SENDIRI ke develop. Pelanggaran beruntun v318 v319 v320 v325 tercatat BOARD; karya tetap diadopsi tapi pelanggaran dicatat. Tunggu perintah merge PM.
- Lapor: nama branch, hash komit, hasil gates, nama berkas.
