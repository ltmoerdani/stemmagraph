# STG v135: RESN export wiring (improve/stg-v135-resn-export-wiring)

Tanggal: 2026-09-21, sekitar 10:25 WIB

## Dikerjakan
- Base: ee9e1c2 (identik develop), reset ke origin cabang yang sudah ada.
- src/lib/gedcom/exportGedcom70.ts: field opsional memberResn di
  ExportGedcom70Input (pola famcStat), import resolveExportResn, blok RESN
  loop INDI diganti: recordResn dari jalur PRIVACY living-private existing
  (gate full+living+private utuh), eventResn dari memberResn, precedence
  event atas record via resolveExportResn. CONFIDENTIAL: tanpa tag RESN
  sama sekali. Nihil: tidak menulis apa pun (byte-identity).
- src/lib/gedcom/exportGedcom70.resn-wiring.test.ts: baru, 9 kasus
  (t1 byte-identity, t2 CONFIDENTIAL, t3 PRIVACY, t4 LOCKED, t5 precedence,
  t6 perilaku lama, t7 multi-nilai koma + array, t8 exportGedzip,
  t9 id tak dikenal).

## Komit
- ab00c4e feat(gedcom): wiring memberResn ke exportGedcom70 via resolveExportResn v135
- Push origin improve/stg-v135-resn-export-wiring: sukses

## Verifikasi (semua hijau)
- vitest exportGedcom70.resn-wiring.test.ts: 9/9 pass
- vitest exportGedcom70.test.ts: 18/18 pass
- vitest rt-testfiles.validation.test.ts: 9/9 pass (byte-exact)
- npx tsc --noEmit: exit 0
- eslint 2 berkas terdampak: exit 0
- grep em dash di diff ee9e1c2..HEAD: 0
