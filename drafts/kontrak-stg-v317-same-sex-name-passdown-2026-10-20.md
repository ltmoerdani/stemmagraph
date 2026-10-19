# Kontrak v317-STG-SAME-SEX-NAME-PASSDOWN FASE I (modul pure + test)

Tanggal: 2026-10-20. Penyusun: PM Ardi (derivasi mandiri dari VISION Stemmagraph, jangkar diverifikasi first-hand wake-77).

## Jangkar (terverifikasi first-hand PM 20 Okt, NameRepository.php baris 450, repo magicsunday/webtrees-statistics)

- sameSexNamePassdownByCentury(): LineChartPayload, dua seri father-son dan mother-daughter pada sumbu abad lahir anak.
- MIN_COHORT_SIZE = 10 (baris 75): koer per abad dengan pasangan kurang dari 10 disembunyikan per seri (no data), abad tetap di sumbu bila salah satu seri lolos floor.
- Token nama: n_givn dipecah token, fold case dan diakritik (Jose beraksen sama dengan Jose polos), inisial satu huruf dibuang dari kunci grouping.
- Match: irisan token parent dan child tidak kosong, urutan dan posisi token tidak penting (contoh jangkar: Johann Friedrich vs Wilhelm Friedrich match via Friedrich).
- Abad: dari tahun lahir anak lower-bound; tahun 0 tidak pernah ada; BCE negatif sah dan fold ke abad negatif.
- Item VISION: differensiator data Stemmagraph (statistik onomastik genealogis pure, tanpa komersial).

## Anti-dup (diverifikasi PM wake-77)

- grep passdown, namePassdown di src/ dan server/ NIHIL.
- v317 dan passdown NIHIL di GOAL_HISTORY.md dan drafts/.
- Beda substantif dari v311 given-name trends (frekuensi nama per dekade) dan v313 surname-marriage matrix (matriks chord marga-pernikahan).
- Kesimpulan: BERSIH, boleh disiapkan.

## Scope (2 berkas BARU saja, plus kontrak ini)

1. src/lib/stats/name-passdown.ts (modul pure, tanpa I/O, tanpa import komersial).
2. src/lib/stats/name-passdown.test.ts (vitest, 12 sampai 14 kasus).

DILARANG menyentuh berkas lain. DILARANG mengubah lockfile. DILARANG merge sendiri ke develop.

## Spesifikasi perilaku (keputusan desain PM, preseden modul pure v312 sampai v316)

Export: computeSameSexNamePassdown(pairs: NamePassdownPair[]): NamePassdownResult

Tipe:

- NamePassdownPair { parentGivn: string; childGivn: string; childBirthYear: number | null; parentSex: string | null }
- NamePassdownResult { categories: number[]; fatherSon: (number | null)[]; motherDaughter: (number | null)[] }

Proses:

1. Tokenisasi parentGivn dan childGivn: pecah pada spasi, trim. Normalisasi tiap token: lowercase, buang tanda diakritik (dekomposisi NFD lalu buang combining marks). Buang token kosong dan token berpanjang 1 karakter (inisial).
2. Validasi pasangan: childBirthYear harus number bukan null, bukan NaN, bukan 0; parentSex 'M' atau 'F' case-insensitive; kedua sisi punya minimal 1 token valid. Gagal salah satu: pasangan dibuang tanpa error.
3. Abad anak: century = Math.floor(year / 100) * 100 (tahun negatif menghasilkan abad negatif).
4. Kelompokkan per seri (M ke fatherSon, F ke motherDaughter) dan per abad: total bertambah 1; bila irisan token parent dan child tidak kosong maka matches bertambah 1.
5. categories = union abad dari kedua seri, diurut menaik.
6. Untuk tiap seri dan tiap abad di categories: bila total kurang dari 10 maka nilai null; selain itu nilai Math.round((matches / total) * 10000) / 10000 (fraksi 0 sampai 1, 4 desimal).

Kasus edge wajib dites:

- Array kosong: categories [], fatherSon [], motherDaughter [].
- childBirthYear null atau 0: pasangan dibuang.
- parentSex 'U' atau null: pasangan dibuang.
- Fold diakritik: parent Jose vs child Jose beraksen: match.
- Inisial satu huruf tidak dihitung token: parent "J. Friedrich" vs child "Friedrich" tetap match via Friedrich, dan "J." tidak memicu match palsu.
- Match token posisi tengah: Johann Friedrich vs Wilhelm Friedrich: match.
- Koer 9 pasangan: null. Koer tepat 10: nilai fraksi.
- Dua seri independen: abad yang hanya punya data fatherSon tetap muncul di categories, motherDaughter null di abad itu.
- Tahun BCE negatif -50: abad -100.

Parser strict: input bukan array (null, undefined, object) wajib melempar Error, pola koreksi QA v308.

## Gates (mirror v312 sampai v316)

- npm ci (lockfile nihil berubah setelahnya, package.json nihil berubah).
- npx vitest run src/lib/stats/name-passdown.test.ts: 12+ kasus lulus.
- npx tsc --noEmit rc 0.
- npx eslint kedua berkas rc 0.
- npx vite build rc 0.
- grep em dash di kedua berkas: 0 hit.
- Regresi src/lib/stats/: nihil FAIL baru.
- Karakter em dash dilarang di semua tulisan termasuk pesan komit.

DILARANG merge sendiri ke develop. Lapor akhir: nama cabang, SHA komit, output gates.
