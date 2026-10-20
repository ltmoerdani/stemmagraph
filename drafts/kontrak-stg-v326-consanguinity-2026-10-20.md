# KONTRAK V326-STG-CONSANGUINITY FASE I (PM Ardi, 20 Okt 2026)

Item: modul pure konsanguinitas, pasangan MARR yang berbagi leluhur, klasifikasi derajat.

## Jangkar
- Riset improver 20 Okt: PLOS ONE Alvarez & Ceballos 2009 (inbreeding dinasti Eropa), Wikipedia Pedigree collapse (Gunderson, Habsburg). Band derajat adalah desain internal kontrak (improver: tidak ada tabulasi standar lembaga, pola band internal v318 v319).
- Bukan duplikat: v296 known-ancestors mengukur completeness leluhur dari SATU root; v313 surname-marriage-matrix berbasis NAMA; v326 mengukur hubungan darah ANTARA dua pasangan satu union.

## Scope (ADD-ONLY 2 berkas baru)
1. `src/lib/stats/consanguinity.ts` modul pure, tanpa import apa pun kecuali tipe `FamilyGraph` dari `../genealogy/family-graph`.
2. `src/lib/stats/consanguinity.test.ts` vitest, minimal 14 kasus.

DILARANG menyentuh berkas lain, dilarang ubah lockfile/package.json.

## Spesifikasi perilaku
- Input: `FamilyGraph` (unions dengan spouses, parentEdges anak ke ortu).
- Per union dengan TEPAT 2 spouse berbeda id: hitung jarak generasi dari tiap spouse ke SEMUA leluhur termasuk dirinya (dist diri = 0, naik via parentEdges, BFS).
- Common ancestor = irisan himpunan leluhur (termasuk diri) kedua spouse.
- k = nilai MINIMUM atas semua common ancestor c dari dist(a,c) + dist(b,c). k >= 1 untuk spouse beda id.
- Output `ConsanguinityResult`: `unionsEvaluated` (union tepat 2 spouse beda), `unionsSkipped` (union selain itu), `unionsWithCommonAncestor`, `proportionPct` (100 * with / evaluated, round 1 desimal; evaluated 0 -> 0), `degreeCounts` array `{ k, count }` urut k menaik, hanya k yang count > 0.
- Deterministik: urutan union dari urutan fam input; tanpa random, tanpa Date, tanpa I/O.
- Graph kosong atau tanpa union valid: hasil nol, TIDAK throw.
- ParentEdge cycle tidak mungkin (data silsilah DAG), tapi BFS tetap aman via visited per akar.

## Test wajib (minimum)
Empty graph; union 1 spouse; union 3 spouse; pasangan tanpa leluhur bersama; saudara kandung k=2; sepupu pertama k=4; orang tua anak k=1; paman keponakan k=3; pasangan dengan DUA jalur common ancestor ambil k minimum; remarriage dua union pasangan sama dihitung terpisah; proportionPct pembulatan 1 desimal; degreeCounts urutan menaik; unionsSkipped benar; graph tanpa edge ortu (k tidak ada).

## Gates (mirror v324 v325)
- `npx vitest run src/lib/stats/consanguinity.test.ts` hijau penuh.
- `npm run build` rc 0 (termasuk guard pure-core).
- `npx tsc --noEmit` rc 0.
- `npx eslint` scope 2 berkas nihil temuan.
- Em dash 0 di seluruh diff. Nihil pattern komersial.

## Proses
- Cabang `improve/stg-v326-consanguinity` (SUDAH ada di origin, kontrak komit pertama). GUNAKAN cabang ini, JANGAN buat baru.
- Sinkron dulu: `git fetch origin && git checkout improve/stg-v326-consanguinity && git merge origin/develop` bila develop maju.
- Komit dini target menit 5 sampai 10. Commit granular. Push tiap komit.
- DILARANG MERGE SENDIRI ke develop. Pelanggaran merge sendiri v318 v319 v320 v325 sudah tercatat di BOARD; karyamu tetap diadopsi tapi pelanggaran dicatat. Tunggu perintah merge PM.
- Lapor: nama branch, hash komit, hasil gates, nama berkas.
