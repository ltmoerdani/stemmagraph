# KONTRAK V318-STG-COUPLE-AGE-GAP FASE I (modul pure + test)

Project: Stemmagraph (repo /home/zeroclaw/projects/stemmagraph)
Branch kerja: improve/stg-v318-couple-age-gap (dibuat PM dari origin/develop 81a1526, kontrak di komit pertama cabang)
Jangkar resmi: wt_statistic.php baris 883 getCoupleAgeGapDistribution delegasi ke MarriageRepository::ageGapDistribution. Doc comment jangkar: "Couple age-gap histogram as a two-sided bucket: each shared magnitude band carries the count of couples where the husband is the older partner (left) and where the wife is (right)". Return type jangkar array<string, array{left:int,right:int}>.

## DEFINISI PERILAKU (spesifikasi mengikat)

Input: array pasangan (pair) mirip marriage-age.ts v280:
- pairId, spouseA {id, birthDate}, spouseB {id, birthDate}. marriageDate TIDAK dibutuhkan modul ini (gap dihitung dari selisih tahun lahir kedua pasangan, anchor jangkar mengukur gap usia antar pasangan bukan usia saat menikah).
- Tanggal lahir: interface sama dengan MarriageAgeDate (dateKind, yearStart, monthStart, dayStart). Hanya EXACT lengkap (y+m+d) yang valid; kind lain atau null mengecualikan pasangan.

Filter per pasangan (urutan penting):
1. Salah satu birthDate null atau dateKind bukan "EXACT" atau ada komponen y/m/d null: pasangan di-skip.
2. birthYearA dan birthYearB sama persis: bucket "equal" (bukan left/right).
3. Selisih dihitung pada tahun lahir: gap = |birthYearA - birthYearB|. Tahun lahir wajib yearStart > 0 (yearStart <= 0: pasangan di-skip, guard data tua/BCE tidak valid untuk domain ini).

Bucket magnitude (band sama dipakai dua sisi, konsisten jangkar):
- "0-2": gap 0 sampai 2
- "3-5": gap 3 sampai 5
- "6-10": gap 6 sampai 10
- "11-15": gap 11 sampai 15
- "16-20": gap 16 sampai 20
- "21+": gap >= 21

Output computeCoupleAgeGapDistribution(pairs): Record<band, {left:number, right:number}> dengan:
- left = pasangan dengan suami (spouseA) LEBIH TUA (birthYearA < birthYearB).
- right = pasangan dengan istri (spouseB) LEBIH TUA (birthYearA > birthYearB).
- equal masuk bucket "0-2" pada field equal terpisah: bentuk {left, right, equal} per band; hanya band "0-2" yang boleh punya equal > 0. Alasan: mempertahankan bentuk seragam supaya konsumen UI fase iii tidak perlu guard bentuk.
- SEMUA band WAJIB hadir di output walau count 0 (bentuk stabil, pola v299 age bands).
- Urutan kunci output: "0-2", "3-5", "6-10", "11-15", "16-20", "21+".

Parser strict (wajib, pola v308): fungsi parseCoupleAgeGapPairs menerima baris JSON atau array objek; nilai field hilang atau tipe salah LEMPAR Error dengan pesan menyebut indeks dan field, TIDAK silent-filter.

Deterministik: iterasi urut pairId ascending sebelum agregasi; hasil identik untuk input sama apapun urutan array asli.

Nihil pasangan valid: tetap kembalikan objek 6 band dengan semua count 0 (BUKAN null; jangkar berbentuk histogram bukan scalar).

## TEST (target 14 kasus, file src/lib/stats/couple-age-gap.test.ts)
Minimal mencakup: happy path per band, boundary tepat 2, tepat 3, tepat 10, tepat 11, tepat 20, tepat 21, equal (gap 0 tahun sama), suami lebih tua vs istri lebih tua dua arah, pasangan ter-skip (null, kind ABOUT, komponen bulan null), yearStart 0 di-skip, parser strict lempar Error (2 kasus: field hilang, tipe salah), determinisme urutan input diacak hasil sama, array kosong menghasilkan 6 band nol.

## GATES (QA R1 PM, semua wajib lulus)
- npx vitest run src/lib/stats/couple-age-gap.test.ts: 14/14.
- npm run build rc 0.
- npx tsc --noEmit rc 0.
- npx eslint kedua file ts rc 0.
- Regresi src/lib/stats: nihil fail baru (baseline penuh 408/408 pasca v317).
- Em dash 0 di diff cabang. Lockfile dan package.json nihil berubah.

## SCOPE (tepat 3 berkas vs develop)
1. drafts/kontrak-stg-v318-couple-age-gap-2026-10-20.md (baru, komit kontrak PM).
2. src/lib/stats/couple-age-gap.ts (baru, modul pure, tanpa import server/prisma/fetch).
3. src/lib/stats/couple-age-gap.test.ts (baru).

## ATURAN EKSEKUTOR
- ATURAN GIT WAJIB: repo stemmagraph; cabang improve/stg-v318-couple-age-gap SUDAH ada di origin berisi kontrak; checkout cabang itu, JANGAN buat cabang baru, JANGAN rebase.
- Kerjakan fase i sesuai spesifikasi di atas. Commit granular, push ke origin cabang yang sama.
- DILARANG merge ke develop atau branch lain. DILARANG menyentuh main/staging.
- Lapor: nama cabang, hash komit, hasil gates.
