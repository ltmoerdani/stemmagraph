# Kontrak GOAL v365-STG-DEATHS-BY-DECADE fase i

- Project: Stemmagraph (T0d statistik). Prioritas #2. Base: origin/develop a477304.
- Jangkar resmi: wt_statistic.php getDeathsByDecade delegasi LifeSpanRepository::deathsByDecade, keluarga anchor getBirthsByDecade baris 497 dan getCumulativeBirthsByDecade baris 509 (dokumentasi kontrak v352); varian kematian memakai semantik identik pada input deathDate. Rujukan pola, bukan salinan kode.
- Anti-dup: grep deathsByDecade deaths-by-decade NIHIL di src server docs GOAL_HISTORY (verifikasi PM wake-127). child-mortality, death-pyramid, death-seasonality, mortality-anomalies, deaths-by-country, age-at-death beda substantif. BERSIH.
- Scope: TEPAT 2 berkas BARU di src/lib/stats/: deaths-by-decade.ts + deaths-by-decade.test.ts. Dilarang sentuh berkas lain, lockfile, server.
- API modul (pure, deterministik, tanpa any):
  - computeDeathsByDecade(entries: unknown): DeathsByDecadeResult
  - input: array entri ber-index; tiap entri harus objek dengan deathDate string format YYYY-MM-DD valid; parser strict LEMPAR Error (prefiks pesan deaths-by-decade:) untuk: input bukan array, entri bukan objek ber-index, deathDate bukan string, format tanggal salah, tanggal tidak valid secara kalender (1900-02-29 tidak valid, 2000-02-29 valid, Date.UTC deterministik UTC).
  - DeathsByDecadeResult: { series: Array<{ decade: number, count: number }> } decade integer kelipatan 10 ASC.
  - Dekade = floor(tahun / 10) * 10. Pangkas leading dan trailing decade ber-count 0; inner decade bernilai 0 DIPERTAHANKAN agar gap historis terlihat; array kosong menghasilkan series kosong tanpa throw.
  - Deterministik: urutan input tidak memengaruhi output (akumulasi per kunci dekade sebelum pembentukan series).
- Test: vitest minimal 16 kasus mirror v352: kosong, satu dekade, dua dekade ASC, trimming leading, trimming trailing, inner zero dipertahankan, boundary 1899/1900 dan 1999/2000, format salah throw tiap jenis, tanggal invalid throw, 29 Feb kabisat vs non-kabisat, input acak urutan tetap identik (determinisme), idempoten pangkas.
- Gates: npm ci, npx vitest run kedua berkas baru (lulus penuh), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0 di diff, baseline genealogy 2106 test 158 file tidak boleh turun.
- Proses: branch improve/stg-v365-deaths-by-decade dibuat DARI develop. Komit dini menit 5 sampai 10. PUSH SETIAP KOMIT ke origin segera setelah commit (push per komit, wajib). DILARANG merge sendiri ke develop. Dilarang sentuh main dan staging. Lapor: repo, berkas diubah, hasil gates, nama cabang, hash origin.
