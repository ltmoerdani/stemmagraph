# Worklog 2026-09-20: STG v125 fase i FAMC-STAT (Stemmagraph)

- Jam: ~11:10 WIB
- Repo: /home/zeroclaw/projects/stemmagraph
- Branch: improve/stg-v125-i-famc-stat (dari develop 983699b)
- Commit: 3277595 feat(gedcom) modul pure FAMC-STAT; 9fb6751 test(gedcom) 23 kasus
- File: src/lib/gedcom/famcStat.ts (baru, 110 baris), src/lib/gedcom/famcStat.test.ts (baru, 292 baris)
- Isi: parseFamcStat (enum 3 nilai, invalid diabaikan + warning, duplikat pakai pertama), serializeFamcStat + serializeFamcStatStruct (nihil = tanpa lini STAT)
- Verifikasi: vitest src/lib/gedcom 302/302 lolos (23 file, termasuk 23 test baru); tsc --noEmit rc 0; eslint rc 0; em dash di diff 0; guard pure core src/ server/ 0 hit
- Merge develop ke branch: up to date, tanpa konflik; push origin ok
- Tidak menyentuh server/index.ts, prisma schema, file komersial; tidak ada commit ke main
- Catatan: 3 putaran perbaikan test (level lini GEDCOM di fixture, assertion payload null vs undefined), bukan perubahan perilaku modul
