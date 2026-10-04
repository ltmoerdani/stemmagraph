# Worklog 21 Sep 2026: v133-i RESN event-level parse pure

- Branch: improve/stg-v133-i-resn-event-level (base develop 561d571)
- Komit:
  - 7553ceb feat(gedcom): modul pure extractEventResn dan effectiveResn level event
  - 93ab2bd test(gedcom): kasus RESN level event atas fixture maximal70
- Berkas baru:
  - src/lib/gedcom/event-resn.ts (extractEventResn, effectiveResn, normalizeResnToken, normalizeResnLine)
  - src/lib/gedcom/event-resn.test.ts (10 kasus)
- Gates:
  - vitest event-resn.test.ts: 10 passed (10)
  - vitest rt-testfiles.validation.test.ts: 9 passed (9), tetap hijau
  - tsc --noEmit: rc 0
  - eslint kedua berkas: rc 0
  - grep em dash kedua berkas: 0
- Jam selesai: 11:45 (UTC+7)
- Catatan: referensi merged ternyata src/lib/privacy/resn.ts (bukan src/lib/genealogy/resn.ts); pola case-insensitive dan nilai raw dipertahankan mengikuti berkas itu. Tidak ada merge ke develop, tidak ada perubahan schema/server/lockfile.
