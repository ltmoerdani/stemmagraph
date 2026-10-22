# Kontrak GOAL v353-STG-CHILDLESS-FAMILIES fase i

- Project: Stemmagraph (T0d statistik). Prioritas #2. Base: origin/develop 6c9aa79 (merge v352).
- Jangkar resmi: wt_statistic.php getChildlessFamiliesDistribution baris 1046 yang mendelegasikan childrenRepository::childlessFamiliesDistribution. Semantik resmi: breakdown keluarga tanpa anak untuk donut chart, tiap entri berisi label string, value int, class string (tiga kelas donut resmi Webtrees).
- Anti-dup: grep childless NIHIL di src server GOAL_HISTORY. family-size-stats (bucket ukuran keluarga zero/1-2/3-4/5+) beda substantif: itu agregat angka per bucket, ini breakdown per kategori berlabel untuk donut. top-largest-families dan most-children-per-person juga beda substantif. BERSIH.
- Scope: TEPAT 2 berkas BARU di src/lib/stats/: childless-families.ts + childless-families.test.ts. Dilarang sentuh berkas lain, lockfile, server.
- API modul (pure, deterministik, tanpa any):
  - computeChildlessFamilies(entries: unknown): ChildlessFamiliesResult
  - input: array entri ber-index; tiap entri harus objek dengan field label string non-kosong dan value number bulat non-negatif. Entri tidak memenuhi kontrak = LEMPAR Error (prefiks pesan childless-families:) untuk: input bukan array, entri bukan objek ber-index, label bukan string atau kosong, value bukan number bulat atau negatif.
  - ChildlessFamiliesResult: { total: number, classes: Array<{ label: string, value: number, kind: ChildlessKind }> }
  - kind dipetakan dari label secara case-insensitive, normalisasi spasi dan tanda hubung: berisi childless tanpa kualifikasi = 'childless'; berisi have children / with children / has children = 'withChildren'; lainnya = 'other'. Properti class PHP tidak direplikasi karena terikat presentasi, kind TypeScript adalah padanan semantiknya.
  - total = penjumlahan semua value; array kosong menghasilkan total 0 dan classes kosong.
- Test: vitest minimal 14 kasus: kosong, satu entri, dua entri, total akurat, pemetaan kind childless, pemetaan kind withChildren (varian have children, with children, has children, huruf besar campuran), pemetaan kind other, normalisasi tanda hubung dan spasi, input bukan array throw, entri bukan objek throw, label kosong throw, label bukan string throw, value negatif throw, value pecahan throw.
- Gates: npm ci, npx vitest run berkas baru (lulus penuh), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0 di diff, baseline genealogy tidak boleh turun.
- Proses: komit dini menit 5 sampai 10, push origin cabang improve/stg-v353-childless-families. DILARANG merge sendiri ke develop (pelanggaran v318-v320 v336 v338 dicatat). Dilarang sentuh main dan staging. Lapor: repo, berkas diubah, hasil gates, nama cabang.
