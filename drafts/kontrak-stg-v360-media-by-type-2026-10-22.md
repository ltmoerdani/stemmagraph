# Kontrak GOAL v360-STG-MEDIA-BY-TYPE fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-125)

- Jangkar: wt_statistic.php baris 626 getMediaByType(): media objects dikelompokkan per recorded source-media type, most-frequent first, keyed by raw GEDCOM type token; view yang menerjemahkan token ke label. Repo jangkar: salinan first-hand wt_statistic.php di workspace PM.
- Anti-dup BERSIH first-hand wake-125: grep mediaByType / MediaByType nihil di src/ server/ origin/develop, nihil di drafts/ repo; tidak ada modul serupa di src/lib/stats/ (67 modul terinventarisasi). Tidak ada model Media di prisma/schema.prisma, modul tetap PURE transformasi array.
- Beda substansi dari modul existing: tidak ada modul media apa pun di src/lib/stats/; kandidat v361 record-inventory mengukur density enrichment, bukan distribusi tipe media.
- Basis cabang: origin/develop 895e3ac (v359 merged wake-124, origin DAN github identik terverifikasi).

## AC

1. TEPAT 2 berkas BARU: src/lib/stats/media-by-type.ts dan src/lib/stats/media-by-type.test.ts. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import server/, tanpa prisma, tanpa fetch, tanpa I/O, tanpa Date runtime, tanpa random, deterministik. Pola rujukan struktur: divorces-by-century.ts v347 (null masuk penghitung undated), bukan salinan kode.
3. API modul: computeMediaByType(media: { mediaId: string; typeToken: string | null }[]): MediaByTypeResult. Output: { tokens: Array<{ token: string; count: number }>, undatedCount: number, total: number }. total = panjang input; undatedCount = banyak entri typeToken null; count per token = banyak entri dengan token persis itu.
4. Urutan tokens: count desc; tie-break token localeCompare asc (deterministik, pola v349-v359). Token dipertahankan RAW: TANPA case folding (IMAGE dan image adalah dua bucket beda), TANPA trim, TANPA normalisasi, sesuai jangkar keyed by raw GEDCOM type token.
5. Parsing strict struktur input (prefiks media-by-type, pola v349): media bukan array, entri bukan objek, mediaId bukan string atau string kosong, typeToken bukan string dan bukan null: DILEMPAR Error ber-index, bukan difilter diam-diam. Token string kosong juga Error (bukan bucket sah, bukan undated).
6. Entri mediaId duplikat SAH dan tetap dihitung per entri (modul menghitung objek media, bukan id unik; dokumentasikan di header).
7. Test vitest minimal 14 kasus mencakup: grouping dasar tiga token; most-frequent first; tie dua count sama urut localeCompare asc; typeToken null masuk undatedCount tanpa throw; input kosong menghasilkan tokens kosong undatedCount 0 total 0; total = sum counts + undatedCount; case sensitivity IMAGE vs image dua bucket; mediaId duplikat tetap dihitung; token kosong throw; typeToken angka throw; mediaId kosong throw; media bukan array throw; entri bukan objek throw; determinisme urutan output terhadap dua urutan input berbeda (hasil identik).
8. Gates: npx vitest run media-by-type (baru semua lulus), npx vitest run src/lib/genealogy (baseline tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, guard pure-core lolos (prebuild), em dash 0 di kedua berkas.
9. Komit granular di cabang improve/stg-v360-media-by-type, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.

## Item vision

Stemmagraph pilar statistik keluarga (deret v308-v359, turunan pipeline GOAL statistik demografi), inline VISION-stemmagraph. Tidak menyentuh Zertifico.
