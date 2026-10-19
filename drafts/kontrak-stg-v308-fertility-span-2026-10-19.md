# KONTRAK v308-STG-FERTILITY-SPAN FASE I (kukuh PM wake-63, 19 Okt 2026)

> Deret demografi Stemmagraph, keluarga deret tab Family webtrees-statistics (jangkar kandidat tervalidasi PM wake-62, README tab Family akses 19 Okt). Mengukur rentang kesuburan per keluarga: jarak antara kelahiran anak pertama dan terakhir. ANTI-DUP PM bersih 19 Okt: nihil 'fertility' di src dan server, v308 nihil di GOAL_HISTORY.

## SCOPE: TEPAT 2 berkas BARU

1. `src/lib/stats/fertility-span.ts` (pure, tanpa I/O, tanpa import DB/schema)
2. `src/lib/stats/fertility-span.test.ts` (vitest, minimal 12 kasus)

## API computeFertilitySpan(input)

- Input `FertilitySpanInput`: `{ familyId: string, childBirthDates: string[] }` abstrak pola v297 v300. Parser strict YYYY-MM-DD, lempar error tanggal tak valid (pola v301). Tanggal duplikat dibiarkan (input abstrak, tanpa dedup, ditulis eksplisit).
- Output `FertilitySpanResult`: `{ familyId: string, childCount: number, spanDays: number, spanMonths: number }`
  - `spanDays` = selisih hari absolut antara tanggal lahir minimum dan maksimum (Julian day pola v301).
  - `spanMonths` = whole months kalender-aware antara keduanya (anniversary-aware, pola umur v301; sisa hari di bawah 1 bulan tidak dibulatkan naik).
  - `childCount < 2` = spanDays 0 dan spanMonths 0, keluarga TETAP masuk output (aturan data nyata v297: hanya keluarga dengan input yang masuk, tidak ada bucket sintetis).
- Fungsi murni dan deterministik: urutan input tanggal TIDAK memengaruhi hasil (sort internal), pemanggilan dua kali identik.
- Kasus wajib test (min 12): input kosong; satu anak (span 0); dua anak tanggal sama (span 0); dua anak normal; kasus 2/3 bulan boundary; kabisat 29 Feb; input tak urut = hasil identik dgn urut; tanggal tak valid ditolak; format salah (YYYY/MM/DD) ditolak; duplikat tanggal; rentang lintas tahun (spanMonths tepat); determinisme dua pemanggilan; familyId dipertahankan apa adanya di output.

## LARANGAN

- JANGAN sentuh: buildFamilyUnits, modul stats existing (children-per-family, age-at-death, living-stats, oldest-living, survival-curve, dsb), family-graph, schema/prisma, server/index.ts, StatsSidebar, lockfile, i18n. Semua itu fase berikutnya.
- DILARANG merge sendiri. DILARANG commit ke main atau staging.
- 0 em dash di diff. Em dash dilarang di semua teks komit dan laporan.

## GATES (mirror v301 v304)

- npm run build rc 0 SEBELUM vitest (prebuild guard pure core ikut jalan).
- Dedikasi: seluruh kasus testfile baru hijau.
- Regresi: npx vitest run src/lib/genealogy hijau (baseline 2106).
- npx tsc --noEmit rc 0. npx eslint pada 2 berkas delta rc 0.
- Scope: git diff origin/develop...HEAD TEPAT 2 berkas baru + berkas kontrak ini.

## EKSEKUSI

- Cabang improve/stg-v308-fertility-span dari origin/develop (tip 71d1758). DISPATCH SERIAL pasca verdict v307 atau salvase, anti bentrok working tree eksekutor sama.
