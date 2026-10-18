# KONTRAK KUKUH v288-STG-FAMILY-SIZE-API (fase ii)

PM Ardi, 18 Okt 2026, em dash 0. Item: endpoint GET /api/v1/trees/:treeId/stats/family-size mengkonsumsi modul pure computeFamilySizeStats (v287 fase i, merged c9ceb59).

## Putusan basis PM (dari evidence Sena wake ini)

Basis POINTER CHIL, bukan f_numchil: keluarga unit dibangun dari FamilyRelationship data nyata (type spouse/parent/child, pola query route generations v284), BUKAN dari FamilyLink (nihil konsumen DB terverifikasi) dan BUKAN kolom skema baru.
Algoritma pembentukan keluarga di route (inline, pola v284):
1. childToParents: dari rel type parent (memberId ortu, relatedId anak) dan child (kebalikannya), map anak ke set ortu ternormalisasi sorted.
2. Family key A: tiap set ortu unik = satu keluarga, childIds = anak yang berbagi set.
3. Family key B: tiap pasangan spouse (sorted pair) yang TIDAK muncul sebagai key A (subset sama) = keluarga tanpa anak, childIds kosong.
4. Keluarga unit dikirim ke computeFamilySizeStats.

## Scope TEPAT 2 berkas

1. server/index.ts ADD-ONLY satu route + helper pembentuk keluarga lokal (pola v284 generations, tanpa berkas baru server).
2. src/server/stats/family-size-api.test.ts BARU min 10 kasus, harness pola living-stats-api (mock prisma vi.hoisted + express port ephemeral + fetch native).

## Respons dan header

- 200 payload agregat: { average, median, max, distribution, familyCount, excludedCount }. Null modul (nihil keluarga) direpresentasikan familyCount 0, average dan median null, max 0, distribution semua 0 (keputusan PM).
- Cache-Control private no-cache + ETag STRONG hash body, 304 mengulang keduanya (addendum RFC 9111, pola v281 v284).
- requireAuthStatsLiving (401 challenge Bearer) + guardTreeAction view_tree (403).
- Tanpa field individu (gap 3, non-PII agregat saja).

## Kasus test wajib (min 10)

401 tanpa kredensial; 403 non-anggota; 404 tree nihil; 200 pasangan spouse dengan anak dedupe dua ortu; pasangan tanpa anak masuk bucket zero; ortu tunggal tanpa spouse; anak dua ortu tanpa spouse link; tree tanpa relasi apapun (bentuk null); 304 mengulang ETag dan Cache-Control; keys respons tanpa field individu; keluarga rel rusak type lain diabaikan.

## Gates

npm run build rc 0 SEBELUM vitest, dedikasi min 10/10, folder genealogy 2049/2049 nihil regresi, tsc rc 0, eslint delta rc 0, em dash 0 di delta, guard pure core 0 hit, scope name-only TEPAT 2 berkas, DILARANG sentuh schema lockfile src UI. DILARANG merge sendiri. QA R1 PM pasca push stabil atau ambang salvase 75 menit.
