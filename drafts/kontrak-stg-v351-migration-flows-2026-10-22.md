# Kontrak GOAL v351-STG-MIGRATION-FLOWS fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-113)

- Jangkar: `getMigrationFlows(int $topLinks): SankeyFlowsPayload` di wt_statistic.php baris 1228, delegasi `MigrationRepository::flowsByCountry($topLinks)`. Doc comment jangkar: birth-to-death country migration flows siap diagram Sankey tab Places, jalur same-country DIBUANG (tanpa movement), hanya top-N weighted links yang dikembalikan.
- Anti-dup BERSIH first-hand: grep migration-flow/migrationFlow/flowsByCountry nihil di src/ server/ origin/develop 9c08732; migration-distance v319 beda substansi (haversine koordinat, bukan arus negara).
- Pola negara: token terakhir koma, trim, lowercase terverifikasi first-hand di births-by-country.ts extractCountry (mirror v336/v338).
- Basis cabang: origin/develop 9c08732 (v350 merged wake-113, origin DAN github identik terverifikasi ls-remote).

## AC

1. TEPAT 2 berkas BARU: `src/lib/stats/migration-flows.ts` dan `src/lib/stats/migration-flows.test.ts`. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import apa pun. Tanpa I/O, Date, random; deterministik.
3. API modul: `computeMigrationFlows(records: MigrationRecord[], options: { topLinks: number })` dengan `export interface MigrationRecord { id: string; birthPlace: string | null; deathPlace: string | null }`.
4. Negara: extractCountry pola v336 (token terakhir koma bila ada koma, seluruh string bila tidak; trim + lowercase). Bila birthPlace atau deathPlace null ATAU trim kosong ATAU hasil negara string kosong: record dikecualikan dari flows (tidak throw), dihitung excluded.
5. Pasangan same-country (source === target setelah normalisasi): DIBUANG sesuai jangkar, dihitung droppedSameCountry. Pasangan lintas negara diagregasi berbobot: value = jumlah record per pasangan (source, target).
6. topLinks wajib integer >= 1 (0, negatif, pecahan, NaN, bukan number: throw). Sort value DESC, tie source ASC lalu target ASC, ambil topLinks pertama.
7. Output `MigrationFlowsResult { links: Array<{ source: string; target: string; value: number }>, totalPersons: number, withBothCountries: number, droppedSameCountry: number }`. records kosong valid: links kosong tanpa throw.
8. Parsing strict ber-index pola v350/v349 (prefiks migration-flows): records bukan array, entri bukan objek, id bukan string/kosong, birthPlace/deathPlace tipe selain string dan null: DILEMPAR Error ber-index.
9. Test vitest minimal 16 kasus mencakup: kosong; satu arus lintas negara; agregasi bobot dua record pasangan sama; same-country dibuang dan terhitung; excluded birthPlace null; excluded deathPlace null; excluded string kosong; negara token terakhir koma (kota, negara); tanpa koma seluruh string; case-fold lowercase menyatukan varian; topLinks memotong urutan value desc; tie value urut source lalu target; topLinks 0 throw; topLinks 1.5 throw; id kosong throw; birthPlace number throw; determinisme.
10. Gates: npx vitest run migration-flows (lulus semua), npx vitest run src/lib/genealogy (tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0.
11. Komit granular di cabang `improve/stg-v351-migration-flows`, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.
