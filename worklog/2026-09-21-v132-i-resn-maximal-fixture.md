# v132-i: test fixture resmi maximal70.ged untuk RESN multi-nilai

Tanggal: 2026-09-21 03:40 UTC+7. Repo: Stemmagraph. Cabang: improve/stg-v132-resn-maximal-fixture (base origin/develop aa6f087, di-reset hard sebelum kerja).

## Commit
- 7d30064 test(gedcom): validasi RESN multi-nilai end-to-end via maximal70.ged. Push origin OK (aa6f087..7d30064).

## Berkas
- Hanya 1 berkas baru: src/lib/gedcom/rt-resn-maximal.validation.test.ts (127 baris).
- Nol perubahan berkas existing (sesuai larangan keras scope).

## Isi test (6 kasus)
1. FAM @F1@ terparse dengan RESN verbatim 'CONFIDENTIAL, LOCKED'.
2. INDI @I1@ terparse dengan RESN verbatim 'CONFIDENTIAL, LOCKED'.
3. applyResnToPrivacyStatus('CONFIDENTIAL, LOCKED') = 'private' (via parseResnList).
4. applyResnToPrivacyStatus('PRIVACY') = 'private'.
5. buildImportPlan memberi privacyStatus 'private' untuk I1.
6. RESN nihil (null/undefined/'') tanpa throw, hasil null, dan member tanpa RESN tidak punya privacyStatus di plan.

Pola jaringan: fetch gedcom.io + mirror GitHub, strip BOM, skip dengan pesan bila kedua sumber gagal. Sandbox ini punya jaringan, jadi test berjalan penuh tanpa skip.

## Gates
- npx vitest run src/lib/gedcom/rt-resn-maximal.validation.test.ts: 6 pass, 0 fail, 0 skip.
- npx vitest run src/lib/gedcom: 376 pass, 0 fail (32 berkas, di atas baseline 370+).
- npx tsc --noEmit: exit 0.
- npx eslint src/lib/gedcom/rt-resn-maximal.validation.test.ts: exit 0.
- Em dash (U+2014) di seluruh diff origin/develop..HEAD: 0.

## Status
Selesai, sudah push origin. Menunggu QA Dino.
