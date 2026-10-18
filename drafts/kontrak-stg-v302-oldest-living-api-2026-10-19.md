# KONTRAK v302-STG-OLDEST-LIVING-API FASE II (dipukul PM Ardi, 19 Okt 2026)

Status: KUKUH. Cabang: improve/stg-v302-oldest-living-api dari origin/develop 71a1d55. Eksekutor: fullstack (Raka). QA R1: PM first-hand. DILARANG merge sendiri.

## LATAR
Fase i v301 CLOSED END-TO-END merge 71a1d55 (QA R1 PM: build 0, dedikasi 13/13, genealogy 2106/2106, tsc 0, eslint 0, em dash 0). Modul pure computeOldestLiving hidup di src/lib/stats/oldest-living.ts (OldestLivingMember id birthDate isAlive; output OldestLivingEntry id ageYears urut age DESC, tie birthDate ASC, id ASC; topN default 10, topN<=0 kosong).

## SCOPE: TEPAT 2 BERKAS
1. server/index.ts: ADD-ONLY satu route GET /api/v1/trees/:treeId/stats/oldest-living. DILARANG menyentuh baris lain.
2. src/server/stats/oldest-living-api.test.ts: BARU, min 12 kasus.

## AC ROUTE (pola persis v291/v293, cache pola v288)
1. Handler: requireAuth + guardTreeAction(userId, treeId, 'view_tree'); 401/403/404 pola repo (g.statusCode, g.code, g.message).
2. Query: prisma.familyMember.findMany({ where: { treeId }, select: { id: true, birthDate: true, isAlive: true } }). TANPA relasi, TANPA field lain.
3. Filter server: kandidat isAlive true DAN privacyStatus TIDAK sama dengan 'private'. privacyStatus WAJIB masuk select. Anggota dengan privacyStatus 'private' TIDAK BOLEH muncul di output meski paling tua. (Konsisten src/lib/privacy/exportPrivacyGate.ts: private = redact.)
4. Pemetaan ke computeOldestLiving(members, topN). topN dari query ?topN, integer 1 sampai 50, default 10. Non-integer atau di luar rentang: 400 { code: 'INVALID_TOP_N' }.
5. Output: { results: [ { id, ageYears } ] }. DILARANG memuat name, birthDate, atau field PII lain di body (gap 3, pola v268). id diizinkan eksplisit karena modul pure mengembalikan id dan UI fase iii butuh join di sisi klien yang berotorisasi.
6. Cache: private no-cache + ETag strong sha256 body + If-None-Match 304 eksplisit, pola persis stats/living baris 1780 sampai 1802.
7. Error 500: { code: 'OLDEST_LIVING_API_ERROR' }.

## AC TESTFILE (min 12 kasus, pola src/server/stats/family-size-api.test.ts, tanpa DB nyata)
- 200 happy path multi anggota urut age DESC.
- topN default 10.
- topN valid memotong hasil.
- topN 0 dan topN 51 dan topN 'abc' masing-masing 400 INVALID_TOP_N.
- kandidat isAlive false dikecualikan.
- birthDate null atau format rusak dikecualikan modul, route tetap 200.
- privacyStatus 'private' dikecualikan meski paling tua (wajib).
- privacyStatus 'shared' lolos.
- 401 tanpa sesi.
- 404 tree tidak ada.
- 304 saat If-None-Match sama.
- 500 saat prisma.findMany reject.

## LARANGAN
Sentuh modul pure oldest-living.ts, schema, lockfile, route lain, storage, file di luar 2 berkas. DILARANG kode komersial (guard pure core).

## GATES QA R1 (mirror v301)
npm run build rc 0 SEBELUM vitest; vitest dedikasi 12/12; regresi folder src/lib/genealogy baseline 2106/2106 nihil; npx tsc --noEmit rc 0; npx eslint delta rc 0; em dash 0 di delta; scope diff vs develop TEPAT 2 berkas; guard pure core 0 hit.
