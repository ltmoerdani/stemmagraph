# Kontrak GOAL v361-STG-RECORD-INVENTORY fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-125)

- Jangkar: wt_statistic.php baris 614 getRecordInventory(): inventaris tipe rekaman Tree-health tab, count rekaman inti person/family versus tiap tipe enrichment (sources, media, shared notes, repositories, shared locations), plus enrichment density per 100 individu, sinyal pohon telanjang versus pohon ter-sumber baik. Repo jangkar: salinan first-hand wt_statistic.php di workspace PM.
- Anti-dup BERSIH first-hand wake-125: grep recordInventory / record-inventory nihil di src/ server/, nihil di drafts/ repo; tidak ada modul inventaris rekaman di src/lib/stats/ (68 modul terinventarisasi pasca v360). tree-health.ts di src/lib/genealogy mengukur kesehatan pohon lain dimensi, bukan inventaris tipe rekaman.
- Basis cabang: origin/develop 4b8ed20 (v360 merged wake-125, origin DAN github identik terverifikasi).

## AC

1. TEPAT 2 berkas BARU: src/lib/stats/record-inventory.ts dan src/lib/stats/record-inventory.test.ts. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import server/, tanpa prisma, tanpa fetch, tanpa I/O, tanpa Date runtime, tanpa random, deterministik. Pola rujukan struktur: media-by-type.ts v360 (parsing strict ber-prefiks, union type kind), bukan salinan kode.
3. API modul: computeRecordInventory(entries: { recordId: string; kind: RecordKind }[]): RecordInventoryResult dengan RecordKind = person | family | source | media | note | repository | location. Output field urutan tetap: { persons, families, core, sources, media, notes, repositories, locations, enrichment, total, densityPer100 }. core = persons + families; enrichment = sources + media + notes + repositories + locations; total = panjang input.
4. densityPer100 = enrichment / persons * 100 dibulatkan 1 desimal (pembulatan standar toFixed semantics via Math.round(enrichment * 1000 / persons) / 10); persons = 0 menghasilkan null (tidak terdefinisi tanpa individu, dokumentasikan di header).
5. Parsing strict (prefiks record-inventory, pola v360): entries bukan array, entri bukan objek, recordId bukan string atau string kosong, kind bukan salah satu dari 7 nilai enum: DILEMPAR Error ber-index, bukan difilter diam-diam. recordId duplikat SAH dan tetap dihitung per entri (inventaris menghitung rekaman per entri input; dokumentasikan di header).
6. Output TIDAK bergantung urutan input: hanya hitungan per kategori, tanpa pengurutan list (urutan field tetap sesuai AC 3). Test wajib membuktikan dua urutan input berbeda menghasilkan objek identik.
7. Test vitest minimal 14 kasus mencakup: campuran 7 kind sekali jalan dengan hitungan benar; core = persons + families; enrichment = jumlah 5 kategori; density normal dengan pembulatan 1 desimal (contoh 3 enrichment 7 persons = 42.9); persons 0 dengan enrichment positif menghasilkan density null; input kosong menghasilkan semua hitungan 0 dan density null; total = core + enrichment; kind tak dikenal throw; kind bukan string throw; recordId kosong throw; recordId bukan string throw; entri bukan objek throw; entries bukan array throw; determinisme dua urutan input hasil identik.
8. Gates: npx vitest run record-inventory (baru semua lulus), npx vitest run src/lib/genealogy (baseline tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, guard pure-core lolos (prebuild), em dash 0 di kedua berkas.
9. Komit granular di cabang improve/stg-v361-record-inventory, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.

## Item vision

Stemmagraph pilar statistik keluarga (deret v308-v360, turunan pipeline GOAL statistik demografi), inline VISION-stemmagraph. Tidak menyentuh Zertifico.
