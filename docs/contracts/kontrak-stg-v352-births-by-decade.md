# Kontrak GOAL v352-STG-BIRTHS-BY-DECADE fase i

- Project: Stemmagraph (T0d statistik). Prioritas #2. Base: origin/develop c85d6b5.
- Jangkar resmi: wt_statistic.php getBirthsByDecade baris 497 delegasi LifeSpanRepository::birthsByDecade, dan getCumulativeBirthsByDecade baris 509 delegasi cumulativeBirthsByDecade. Semantik resmi: kelompok kelahiran per dekade, leading dan trailing zero-decade DIPANGKAS, inner zero-decade TETAP agar gap historis terlihat, keys integer awal dekade (contoh 1900). Cumulative = running sum pada deret dekade di jendela visible.
- Anti-dup: grep birthsByDecade birth-decade cumulative NIHIL di src server GOAL_HISTORY; births-by-century (per abad) dan age-at-death (usia) beda substantif. BERSIH.
- Scope: TEPAT 2 berkas BARU di src/lib/stats/: births-by-decade.ts + births-by-decade.test.ts. Dilarang sentuh berkas lain, lockfile, server.
- API modul (pure, deterministik, tanpa any):
  - computeBirthsByDecade(entries: unknown): BirthsByDecadeResult
  - computeCumulativeBirthsByDecade(entries: unknown): CumulativeBirthsByDecadeResult
  - input: array entri ber-index; tiap entri harus objek dengan birthDate string format YYYY-MM-DD valid; parser strict LEMPAR Error (prefiks pesan births-by-decade:) untuk: input bukan array, entri bukan objek ber-index, birthDate bukan string, format tanggal salah (termasuk 1900-02-29 tidak valid dan 2000-02-29 valid, Date.UTC deterministik UTC).
  - BirthsByDecadeResult: { series: Array<{ decade: number, count: number }> } decade integer kelipatan 10 ASC.
  - Pangkas leading/trailing decade ber-count 0; inner decade bernilai 0 dipertahankan; array kosong menghasilkan series kosong.
  - CumulativeBirthsByDecadeResult: { series: Array<{ decade: number, cumulative: number }> } berjalan pada deret terpangkas yang sama.
- Test: vitest minimal 16 kasus: kosong, satu dekade, dua dekade ASC, trimming leading, trimming trailing, inner zero dipertahankan, boundary 1899/1900 dan 1999/2000, format salah throw tiap jenis, tanggal invalid throw, 29 Feb kabisat, kumulatif monotonic naik, kumulatif dari input acak urutan tetap identik (deterministik terhadap urutan input), idempoten pangkas.
- Gates: npm ci, npx vitest run berkas baru (lulus penuh), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0 di diff, baseline genealogy tidak boleh turun.
- Proses: komit dini menit 5 sampai 10, push origin cabang improve/stg-v352-births-by-decade. DILARANG merge sendiri ke develop (pelanggaran v318-v320 v336 v338 dicatat). Dilarang sentuh main dan staging. Lapor: repo, berkas diubah, hasil gates, nama cabang.
