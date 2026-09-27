# STG v179-ii fase i: catatan alias di hasil pencarian

Branch: improve/stg-v179-ii-search-results-alias
Commit: 55e3af9

## File diubah
- src/components/FamilyTree/FamilyTable.tsx (add-only, import aliasDisplay, useMemo searchAlias, span catatan di area searchResultsFor)
- src/components/FamilyTree/MemberCardGrid.tsx (add-only, import aliasDisplay, useMemo searchAlias, span catatan di area search results)
- src/components/FamilyTree/search-alias-note.test.tsx (baru, 8 kasus)

## Verifikasi
- npx vitest run src/components/FamilyTree/search-alias-note.test.tsx: 8/8 pass
- npx vitest run src/components/Sidebar/alias-ui.test.tsx (jangkar fase i): 8/8 pass
- npx vitest run src/components/FamilyTree/__tests__/search-wiring.test.tsx: 7/7 pass (regresi wiring lama)
- npx tsc --noEmit: rc 0
- npx eslint (3 file): rc 0, 1 warning pre-existing di FamilyTable.tsx (set-state-in-effect, bukan dari perubahan ini)
- grep em dash di diff: 0
- Full suite src/lib/genealogy + src/components/FamilyTree + src/components/Sidebar: 5 file gagal (MemberEditModal.dedup-warning, MemberEditModal.regrant, ImportControls.citation-wiring) dikonfirmasi PRE-EXISTING di baseline develop 3e39dd7 lewat git worktree terpisah, tidak terkait perubahan branch ini.

## Larangan
Tidak menyentuh kinship-alias-note.ts, kinship-aliases.ts, kinship-alias-phrase.ts, search-filter.ts, kinship-calc, kinship-labels, kinship-phrase. Nihil dependensi baru.
