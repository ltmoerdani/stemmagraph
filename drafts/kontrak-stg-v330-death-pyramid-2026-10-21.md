# Kontrak v330-STG-DEATH-PYRAMID fase i (kukuh PM wake-92, 21 Okt 2026)

## Jangkar (terverifikasi first-hand PM)
- wt_statistic.php baris 527 sampai 535: getDeathsByCenturyAgeBandSex(): PopulationPyramidPayload delegasi ke LifeSpanRepository::deathsByCenturyAgeBandSex(). Doc: age-at-death distribution split by sex, faceted by birth century, binned into 10-year age bands per sex, feeds the population-pyramid widget on the LifeSpan tab. Kohort abad kelahiran sama dengan getDeathAgeDistributionByCentury.

## Anti-dup (BERSIH first-hand PM wake-92)
- grep pyramid dan ageBandSex NIHIL di src dan server develop. nihil v330 di GOAL_HISTORY dan drafts. Beda substantif dari: age-at-death.ts v299 (band dekade tanpa split sex dan kohort), avg-lifespan-sex-century.ts v322 (rerata bukan distribusi), survival curve (persentase hidup bukan kematian), mortality-anomalies (z-score).

## Spec modul pure
- Berkas WAJIB TEPAT 2 BARU add-only: src/lib/stats/death-pyramid.ts dan src/lib/stats/death-pyramid.test.ts. DILARANG menyentuh berkas lain, DILARANG mengubah lockfile.
- Input: list orang { birthDate, deathDate, sex }. Tanggal EXACT saja (ymd), bentuk parsial atau non-EXACT dibuang diam. Parser strict: input bukan array lempar Error, elemen bukan objek lempar Error, field tanggal hilang lempar Error, sex bukan F M U lempar Error (pola parser strict v308 sampai v329).
- Umur: integer tahun penuh (anniversary) deathDate dikurangi birthDate. Umur negatif dibuang.
- Kohort: abad kelahiran floor(birthYear/100)*100, naik.
- Band: 10 tahun, label "n-m" (0-9, 10-19, dst), naik.
- Seri sex: F dan M terpisah per band per kohort. sex U masuk counter excludedUnknownSex, tidak masuk seri.
- Guard: baris band dengan total sampel (F plus M) di bawah MIN_SAMPLES 10 dibuang per kohort (konsisten v322).
- Output deterministik: { cohorts: [ { century, bands: [ { band, female, male } ], excludedUnknownSex } ] } dengan cohort dan band urut naik. Input kosong menghasilkan { cohorts: [] }.
- Deterministik murni, tanpa I/O, tanpa Date.now, tanpa random.

## Test
- vitest minimal 14 kasus: input kosong, band tepat, umur tepat anniversary, umur negatif dibuang, non-EXACT dibuang, komponen parsial dibuang, sex U excluded, dua seri F M independen, kohort abad, guard MIN_SAMPLES, baris band kosong, throw bukan array, throw elemen bukan objek, throw sex invalid, urutan cohort dan band.

## Gates (mirror v324 sampai v329)
- npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, vitest dedikasi lulus penuh, em dash 0 di diff, lockfile nihil berubah, scope tepat 2 berkas BARU.
- DILARANG merge sendiri ke develop. Lapor PM saat push selesai.
