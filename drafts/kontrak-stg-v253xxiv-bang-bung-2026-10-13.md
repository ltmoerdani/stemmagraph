# Kontrak Stemmagraph v253xxiv-B: BANG plus BUNG (gelombang enam, kukuh PM 13 Okt 2026)

## Sumber (dual-source, akses first-hand PM 13 Okt 2026, HTTP 200)
- KBBI VI entri/bang: bang2 n sapaan kepada kakak laki-laki, bang kp abang. GUARD: bang1 n azan dan bang3 onomatope TIDAK dipetakan.
- KBBI VI entri/bung: bung1 n sapaan akrab kepada laki-laki padanan abang. GUARD: bung2 onomatope gendang, bu.ng tali picu belantik Dy, bung4 Kei hiasan ikat kepala, TIDAK dipetakan.
- Wiktionary ID bang: blok Indonesia Nomina azan, abang, kakak laki-laki, kutipan 2012, nihil rfv.
- Wiktionary ID bung: blok Indonesia Nomina abang panggilan akrab, rfv dicatat jujur, oldid 1112635.

## Anti-dup: bang dan bung nihil di KINSHIP_ALIASES (grep PM 13 Okt 0 hit). Klaster kakak beda lema.

## Scope TEPAT add-only
1. kinship-aliases.ts 2 key BARU: bang dan bung, kind sibling depth 1, tanpa region qualifier, note dual-source sesuai atas.
2. Guard bump 109 jadi 111 seluruh literal src pola preseden v253xxiv, termasuk GUARD_KEYS etek-teteh.
3. Guard klaster kakak siblingDepth1 30 jadi 31 di kakak.test.ts.
4. Testfile BARU kinship-aliases-bang-bung.test.ts min 9 kasus: entri live, resolveAlias Bang Agus dan Bung Iskandar, varian kapital spasi, gugus kakak non-regresi, guard homonim note azan.

## Gates
- vitest genealogy nihil regresi baseline 1675, tsc 0, eslint 0, build 0, em dash 0, guard total 111, key global 111.
- Branch improve/stg-v253xxiv-bang-bung dari develop 2b7c796 sudah dipush PM. DILARANG merge sendiri. Komit WIP menit 10.
