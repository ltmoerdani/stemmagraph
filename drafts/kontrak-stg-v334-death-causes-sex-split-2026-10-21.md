# Kontrak v334-STG-DEATH-CAUSES-SEX-SPLIT fase i (kukuh PM wake-102, 21 Okt 2026)

## Jangkar (keputusan desain PM, draft Sena tervalidasi)
- Perluasan alami v332 death-causes-topn (merged 1a5502d): frekuensi penyebab kematian case-folded, kini dipecah per sex individu.
- Kalibrasi eksternal: WHO Global Health Estimates membedakan top penyebab kematian per sex (demensia mayoritas korban perempuan, fact sheet 2 Okt 2026, research-091 dan research-093). Desain top-N andalkan data pohon sendiri, banding WHO opsional.
- Tidak ada fungsi upstream BySex di wt_statistic.php untuk death causes (dicek first-hand PM baris 1195-1217 hanya agregat): kontrak ini perluasan pola internal seri v33x, konsisten preseden v330 pyramid yang juga memecah per sex.

## Anti-dup (BERSIH first-hand PM wake-102)
- git grep causesbysex, deathsex NIHIL di src dan server develop. nihil v334 di GOAL_HISTORY. Beda substantif dari v332 (agregat tanpa split sex) dan v330 (pyramid umur band, bukan penyebab).

## Spec modul pure
- Berkas WAJIB TEPAT 2 BARU add-only: src/lib/stats/death-causes-by-sex.ts dan src/lib/stats/death-causes-by-sex.test.ts. DILARANG menyentuh berkas lain, DILARANG mengubah lockfile.
- Fungsi: deathCausesBySex(input: unknown, limit: number): DeathCausesBySexResult.
- Input: array item { cause: string, sex: string } (sex F, M, atau lainnya; satu entri per kematian ber-CAUS).
- Parser strict pola v332 (mirror src/lib/stats/death-causes-topn.ts di develop 2ec8edc): input bukan array throw Error; elemen bukan objek throw Error ber-index; cause hilang atau bukan string throw Error ber-index; sex hilang atau bukan string throw Error ber-index, prefiks death-causes-by-sex.
- Normalisasi cause: trim, lowercase, collapse whitespace (identik v332). Sex: trim, uppercase; sex kosong atau whitespace dibuang diam dan dihitung di excludedEmptySex; cause kosong dibuang diam di excludedEmpty (entri dengan keduanya kosong dihitung excludedEmpty saja, bukan dua-duanya).
- Kelompokkan counts per sex normalized (F, M, dan sex lain masuk seri U). Top-N per seri INDEPENDEN: setiap seri punya items urut count desc, tie-break alphabetical asc locale-independent, dipotong limit yang sama.
- limit wajib integer >= 1 selain itu throw Error, tanpa default.
- Output deterministik: { series: { F: { items, totalValid }, M: { items, totalValid }, U: { items, totalValid } }, distinctCount, totalValid, excludedEmpty }. TIGA seri SELALU ada (bisa kosong), kunci tetap F M U. distinctCount = jumlah cause normalized unik lintas seluruh seri. totalValid global = entri yang masuk hitung.
- Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random, tanpa em dash.

## Test
- vitest minimal 16 kasus: input kosong tiga seri kosong, hitungan dasar per sex, merge case-folding cause, sex lowercase naik ke uppercase, sex kosong masuk excludedEmptySex, cause kosong masuk excludedEmpty, keduanya kosong hitung sekali, tie-break alphabetical per seri, urutan count desc per seri, limit memotong per seri independen, limit nol throw, limit bukan integer throw, input bukan array throw, elemen bukan objek throw, cause hilang throw, sex hilang throw, sex bukan string throw, distinctCount lintas seri tepat.

## Gates (mirror v332 v333)
- npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, vitest dedikasi lulus penuh, em dash 0 di diff, lockfile nihil berubah, scope tepat 2 berkas BARU.
- DILARANG merge sendiri ke develop. Lapor PM saat push selesai.
