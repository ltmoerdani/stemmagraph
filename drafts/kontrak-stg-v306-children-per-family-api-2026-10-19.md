# KONTRAK v306-STG-CHILDREN-PER-FAMILY-API (fase ii, kukuh PM wake-60, 19 Okt 2026)

Sumber: fase ii dari modul pure v297 children-per-family (merged 435557f). Derivasi PM dari antre kandidat fase ii BOARD wake-59 (children-per-family ada di daftar modul pure tanpa route). Em dash 0.

## Scope TEPAT 2 berkas

1. `server/index.ts`: ADD-ONLY SATU route `GET /api/v1/trees/:treeId/stats/children-per-family` setelah route stats terakhir. DILARANG mengubah kode existing, termasuk `buildFamilyUnits` dan `requireAuthStatsLiving`.
2. Testfile BARU `src/lib/stats/children-per-family-api.test.ts` min 10 kasus, pola `living-stats-api.test.ts`: mock prisma penuh via `vi.hoisted`, server express asli di port ephemeral, fetch native, tanpa dependency baru.

## Kontrak route

- Guard: `requireAuthStatsLiving` (401 bawa challenge Bearer) + `guardTreeAction(req.userId, treeId, 'view_tree')` (403 non-anggota tanpa WWW-Authenticate, 404 tree nihil).
- Data: `prisma.familyRelationship.findMany` select minimal `{ memberId, relatedId, type }` pola family-size; keluarga dibentuk lewat helper existing `buildFamilyUnits(rels)` TANPA diubah; hasil dikonsumsi `computeChildrenPerFamilyDistribution` dari `src/lib/stats/children-per-family.ts` (modul fase i, DILARANG diubah).
- Output 200: payload distribusi penuh `{ distribution: [{ children, familyCount }], familyCount, average }` TANPA field PII (tidak ada id anggota, nama, tanggal). Tree kosong: `{ distribution: [], familyCount: 0, average: 0 }` dari modul.
- Tanpa query param: endpoint tree-wide, tidak ada topN. Nilai bukan kasus 400 INVALID_* nihil untuk endpoint ini.
- Cache: `Cache-Control: private, no-cache` + ETag strong sha256 body + `If-None-Match` cocok dijawab 304 eksplisit yang membawa ulang kedua header (pola persis family-size baris 2085 dan v288).
- Error: catch 500 `{ code: 'CHILDREN_PER_FAMILY_ERROR', message }`.
- Komentar route add-only dalam Bahasa Indonesia, 0 em dash.

## Kasus uji wajib (min 10)

401 tanpa auth; 403 non-anggota; 404 tree nihil; 200 payload penuh tree berisi beberapa keluarga (nilai agregat eksak: bucket children asc, familyCount per bucket, average 1 desimal); tree tanpa relasi anak (family key B spouse childIds kosong, average 0); tree kosong; anak ganda relasi dobel tetap dedup (nilai bucket tidak menggembung); header ETag + If-None-Match menghasilkan 304 dengan Cache-Control terbawa; 500 saat prisma reject (code CHILDREN_PER_FAMILY_ERROR); tidak ada field PII di body (assertion bentuk kunci payload).

## Larangan

Sentuh modul pure children-per-family.ts, buildFamilyUnits, modul stats existing, StatsSidebar, schema, storage adapter, lockfile. DILARANG merge sendiri.

## Gates

`npm ci`; `npm run build` rc 0 SEBELUM vitest; dedikasi 10+; regresi `src/lib/genealogy` + `src/lib/stats` nihil fail substantif (baseline 2292 passed, 5 testfile stats flaky beban paralel dikonfirmasi serial rerun, pola preseden); tsc rc 0; eslint delta rc 0; em dash 0 di diff; scope TEPAT 2 berkas.
