# Kontrak GOAL v354-STG-FAMILY-STATUS fase i

- Project: Stemmagraph (T0d statistik). Prioritas #2. Base: origin/develop 6c9aa79 (merge v352).
- Jangkar resmi: wt_statistic.php getFamilyStatusData baris 267 yang mendelegasikan familyRepository::classifyLivingIndividuals. Semantik resmi: breakdown marital status untuk donut chart living individuals, precedence klasifikasi current > divorced > widowed > single, empat slice yang jumlahnya tepat sama dengan total living individuals tanpa clamping, tiap entri berisi label string, value int, class string.
- Anti-dup: grep MaritalBucket, familyStatus, family-status, maritalBucket NIHIL di src/lib/stats dan server. Field maritalStatus di schema.prisma baris 135 dipakai hanya di jalur GEDCOM import/export dan share/privacy, nihil modul statistik. GOAL_HISTORY nihil v354, drafts nihil v354. BERSIH.
- Scope: TEPAT 2 berkas BARU di src/lib/stats/: family-status.ts + family-status.test.ts. Dilarang sentuh berkas lain, lockfile, server.
- API modul (pure, deterministik, tanpa any):
  - computeFamilyStatus(entries: unknown): FamilyStatusResult
  - input: array entri ber-index; tiap entri harus objek dengan field maritalStatus string. Entri tidak memenuhi kontrak = LEMPAR Error (prefiks pesan family-status:) untuk: input bukan array, entri bukan objek ber-index, maritalStatus bukan string, atau nilai tidak termasuk empat kanonik (married, single, widowed, divorced) setelah trim dan lowercase.
  - FamilyStatusResult: { total: number, classes: Array<{ label: string, value: number, kind: FamilyStatusKind }> }
  - FamilyStatusKind = 'married' | 'single' | 'widowed' | 'divorced'.
  - Output SELALU empat entri urutan tetap: Married, Single, Widowed, Divorced (mirror jangkar webtrees yang memancarkan empat bucket dengan ?? 0). Array kosong menghasilkan total 0 dan empat entri bernilai 0.
  - total = penjumlahan value empat entri.
  - Keputusan desain PM: properti class PHP tidak direplikasi karena terikat presentasi, diganti kind TypeScript padanan semantiknya (konsisten keputusan v353).
- Test: vitest minimal 15 kasus: kosong (empat entri zero, total 0), satu entri married, satu entri single, satu entri widowed, satu entri divorced, campuran dua kind, campuran empat kind, total akurat, case-insensitive (MARRIED, Widowed), trim spasi (spasi pinggir single), throw input bukan array, throw entri bukan objek, throw maritalStatus bukan string, throw nilai tak dikenal (engaged), urutan output tetap married single widowed divorced.
- Gates: npm ci, npx vitest run berkas baru (lulus penuh), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0 di diff, baseline genealogy tidak boleh turun.
- Proses: komit dini menit 5 sampai 10, push origin cabang improve/stg-v354-family-status. DILARANG merge sendiri ke develop (pelanggaran v318-v320 v336 v338 dicatat). Dilarang sentuh main dan staging. Lapor: repo, berkas diubah, hasil gates, nama cabang.
