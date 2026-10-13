# KONTRAK KUKUH: STG v253xxv gelombang tujuh: key alias bulik

Tanggal kontrak: 13 Okt 2026. Penulis: PM Ardi (riset first-hand). Executor: fullstack (Raka). CABANG SUDAH DIBUAT DAN DIPUSH PM: improve/stg-v253xxv-bulik dari tip develop 3b48bae. PULL dulu: git fetch origin && git checkout improve/stg-v253xxv-bulik && git pull origin improve/stg-v253xxv-bulik. DILARANG merge sendiri ke develop. DILARANG menyentuh main atau staging.

## SUBSTANSI: 1 key baru di src/lib/genealogy/kinship-aliases.ts

bulik: {
  kind: 'parent-sibling',
  depth: 1,
  qualifier: 'jw',
  region: 'Jawa',
  note: lihat bawah
}

Sisip ALFABETIS antara bako dan budhe (bak < bul < bud). Pola entri lihat paklik (baris 211) dan budhe.

note wajib memuat: bulik Jawa = sapaan atau panggilan kepada adik perempuan ibu atau ayah (bibi junioritas adik, padanan feminin paklik), ejaan resmi KBBI ber titik bu.lik TIDAK dipakai sbg key (pola budhe dari bu.de), etimologi kependekan ibu cilik; kind parent-sibling depth 1 pola paklik, pasangan feminin gugus paman Jawa (pakde paklik pakdhe budhe bulik); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bulik akses 13 Okt 2026 HTTP 200 (bu.lik n Jw akr kata sapaan atau panggilan kepada adik perempuan ibu atau ayah; ibu cilik, tunggal nihil homograf bernomor) plus Wiktionary EN revid 91711298 via URL api.php en.wiktionary.org/w/api.php?action=query&prop=revisions&titles=bulik&rvprop=ids|content (blok Javanese: noun aunt, parent's younger sister, etimologi shortening of ibu cilik, rujukan R:Horne 1974 hal 98, see also budhe paklik konsisten gugus); GUARD MAKNA: glosa KBBI ibu cilik adalah makna sama etimologis TIDAK dipetakan terpisah; GUARD HOMONIM ANTARBAHASA Wiktionary EN sama TIDAK dipetakan: blok Cebuano (udang prawn Melicertus latisulcatus dan Marsupenaeus japonicus), blok Hungarian (bentukan nomina dari buli pesta), blok Polish ( informal hoki es face-off); halaman id.wiktionary.org/wiki/bulik hanya blok Banjar verba pulang revid 1166238 BUKAN blok Indonesia dan BUKAN blok Jawa, TIDAK dipetakan dan dicatat jujur; referensi kontrak drafts/kontrak-stg-v253xxv-bulik-2026-10-13.md dan Log Supervisi BOARD-stemmagraph 13 Okt 2026.

Anti-dup PM terverifikasi: resolveAlias('bulik') NULL dan nihil di map sebelum kerja (probe test sementara, bukti di Log Supervisi 08:2x).

## GUARD WAJIB (pola preseden 8ba8b7e dan 2642b33)

1. Guard total key: 111 jadi 112. Grep seluruh src: toHaveLength(111) dan toBe(111) dan literal 111 di testfile genealogy. Saat kontrak ditulis ada 45 kemunculan toHaveLength/toBe(111). SEMUA wajib bump, nihil sisa 111 pasca edit (kecuali angka tak terkait, verifikasi konteks satu per satu).
2. GUARD_KEYS konstanta kinship-aliases-etek-teteh.test.ts: 111 jadi 112.
3. Guard klaster parent-sibling GLOBAL: bako.test baris 92 toHaveLength(18) jadi 19 (daftar PERSIS: wajib ditambah bulik sisip alfabetis). ipar.test kasus 4 array 18 entri tanpa ipar jadi 19. Cek juga emang-mang.test kasus 13, generasi-naik.test kasus 15 (14 key urut alfabetis), makcik.test kasus 12 (gugus 11 key): semua daftar parent-sibling yang eksplisit wajib di-refresh dengan bulik. Grep "parent-sibling" di semua testfile untuk menangkap sisanya.
4. bank-lemma.test kasus 13: gugus parent-sibling Jawa 4 entri (pakde paklik pakdhe budhe) jadi 5 entri (tambah bulik).
5. Testfile kakak klaster siblingDepth1 (30 jadi 32 bang bung): TIDAK berubah, bulik parent-sibling bukan sibling. Jangan sentuh.

## TESTFILE BARU: src/lib/genealogy/kinship-aliases-bulik.test.ts

Minimum 9 kasus (pola kinship-aliases-bang-bung.test.ts): (1) entri live: bulik ada di KINSHIP_ALIASES kind parent-sibling depth 1 qualifier jw region Jawa; (2) resolveAlias('bulik') dan varian 'Bulik', ' bulik ' resolve; (3) ejaan bu.lik TIDAK dibuat key, guard negatif; (4) gugus pakde paklik pakdhe budhe tetap utuh non-regresi nilai existing; (5) guard homonim ceb hu pl nihil terpetakan (bulik tetap resolve ke Jawa); (6) guard bjn pulang nihil terpengaruh; (7) guard total 112; (8) posisi alfabetis antara bako dan budhe di Object.keys; (9) determinisme dua kali resolve identik.

## DISIPLIN

- Komit WIP paling lambat menit 10. Push tiap berkas selesai. Komit granular pola 13bf601/2642b33/f17d0bd.
- Gates sebelum lapor: npx vitest run src/lib/genealogy (penuh, nihil gagal), npx tsc --noEmit rc 0, npm run lint 0 error (13 warning pre-existing boleh), npm run build rc 0, em dash 0 di seluruh diff.
- Lapor: nama cabang, daftar komit SHA, ringkas hasil gates.
