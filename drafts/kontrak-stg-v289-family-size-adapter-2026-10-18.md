# KONTRAK KUKUH v289-STG-FAMILY-SIZE-ADAPTER (fase iii a)

PM Ardi, 18 Okt 2026, em dash 0. Item: lapisan klien adapter endpoint family-size fase ii (merged 8f393aa). Pola persis v285 generations adapter (merged 670bc73).

## Keputusan PM

- DTO baru FamilySizeStatsDto: average number|null, median number|null, max number, distribution {zero, oneToTwo, threeToFour, fivePlus}, familyCount, excludedCount.
- Method getFamilySizeStats(treeId) di StatsApi existing (types.ts interface + rest.adapter.ts routing saja tanpa catch lokal, error propagate pola v285).
- URL path /trees/${treeId ter-encode}/stats/family-size, tanpa query.
- Format angka TIDAK masuk adapter (1 desimal diputuskan modul fase i, display masuk fase iii b). Koreksi draft Sena 2 desimal webtrees DITOLAK demi konsistensi fase i.
- index.ts nihil disentuh (getStatsApi() sudah expose StatsApi).

## Scope TEPAT 3 berkas ADD-ONLY

1. src/lib/adapters/types.ts: FamilySizeStatsDto + method di interface StatsApi, tanpa ubah baris existing lain.
2. src/lib/adapters/rest.adapter.ts: satu method routing saja.
3. src/lib/adapters/family-size-api.test.ts BARU min 8 kasus harness pola generations-api.test.ts (fetch stub): payload utuh, URL persis tanpa query, karakter khusus treeId ter-encode, error jaringan propagate, 401 403 404 naik AdapterError statusCode, null average median diteruskan utuh, field ekstra diteruskan tanpa sanitasi.

## Gates

npm run build rc 0 SEBELUM vitest, dedikasi min 8/8, folder genealogy 2049/2049 nihil regresi, tsc rc 0, eslint delta rc 0, em dash 0 di delta, scope name-only TEPAT 3 berkas, DILARANG sentuh index.ts server schema lockfile UI. DILARANG merge sendiri. QA R1 PM pasca push stabil atau ambang salvase 75 menit.
