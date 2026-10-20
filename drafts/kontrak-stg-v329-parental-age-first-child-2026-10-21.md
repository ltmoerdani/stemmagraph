# KONTRAK v329-STG-PARENTAL-AGE-FIRST-CHILD FASE I (kukuh PM wake-91, 21 Okt 2026)

- Project: Stemmagraph (T0d statistik, turunan pilar data-grade). Repo: /home/zeroclaw/projects/stemmagraph.
- Jangkar resmi: wt_statistic.php baris 715-724 getTrimmedAgeAtFirstChildDistributions delegasi ParenthoodRepository::ageAtFirstChildDistribution('M') dan ('F') plus HistogramTrim::dropCoZeroEnds; doc baris 727-734 menyebut trend mean per dekade sbg buffer fase ii. Fase i = histogram band 5 tahun per sex ortu.
- Anti-dup (verifikasi PM wake-91): grep parental dan age-at-first NIHIL di src/ dan server/; nihil v329 di GOAL_HISTORY dan drafts/; beda substantif dari v318 couple-age-gap (usia saat menikah), v280 marriage-age (usia menikah), v287 children-per-family (jumlah anak), v324 multiple-birth (kelahiran multipel).
- Cabang: improve/stg-v329-parental-age-first-child dari origin/develop ea50530. Scope: TEPAT 2 berkas BARU, ADD-ONLY: src/lib/stats/parental-age-first-child.ts dan src/lib/stats/parental-age-first-child.test.ts. Dilarang menyentuh berkas lain, lockfile harus nihil berubah.

## Spesifikasi modul pure parental-age-first-child.ts

1. Input: Array<FirstChildRecord>. FirstChildRecord = { childId: string, birthDate: GedDate | null, father: ParentRef | null, mother: ParentRef | null }; ParentRef = { id: string, birthDate: GedDate | null }; GedDate = { dateKind: string, yearStart: number | null, monthStart: number | null, dayStart: number | null }.
2. Parser strict pola couple-age-gap v318: input bukan array lempar Error; elemen bukan objek lempar Error ber-index; childId atau ParentRef.id hilang atau bukan string lempar Error; birthDate boleh null TAPI kalau bukan objek dan bukan null lempar Error; dateKind wajib string; yearStart monthStart dayStart wajib number atau null. Pesan error memakai prefiks parental-age-first-child dan path field.
3. Validitas tanggal: hanya EXACT dengan ketiga komponen terisi, bulan 1-12, hari 1-31 (pola exactYmd marriage-age.ts). Tanggal tidak valid atau null: record diabaikan untuk seri terkait, BUKAN throw.
4. Usia ortu saat kelahiran anak: fullYears anniversary-aware (pola v267 v280). Usia negatif dibuang.
5. First child per ortu: untuk tiap id ortu, pilih anak dengan tanggal lahir paling awal; tie-break childId ascending; satu ortu dihitung sekali walau muncul di banyak record anak.
6. Dua seri independen: father dan mother. Band 5 tahun: 0-4, 5-9, 10-14, dst, label 'n-m'. Leading dan trailing band ber-count 0 dibuang (HistogramTrim dropCoZeroEnds); band interior kosong DIPERTAHANKAN; seri tanpa data = bands array kosong.
7. Output deterministik: { father: { bands: Array<{ label: string, count: number }>, count: number }, mother: { bands: Array<{ label: string, count: number }>, count: number } }; count = banyak ortu valid dengan first-child age terhitung per seri.
8. Murni: tanpa I/O, tanpa Date.now, tanpa random, urutan deterministik dari input.

## Test vitest minimal 14 kasus

(1) input kosong, kedua seri kosong; (2) satu anak father plus mother, band benar; (3) first child bukan urutan input pertama (anak kronologis lebih awal di posisi kedua); (4) tie-break childId ascending; (5) father null: seri father kosong, seri mother terisi; (6) birthDate non-EXACT dibuang dari seri; (7) komponen tanggal parsial dibuang; (8) usia negatif dibuang; (9) band 5 tahun tepat untuk beberapa usia; (10) leading zero terpangkas; (11) trailing zero terpangkas; (12) interior zero dipertahankan; (13) dua seri independen penuh; (14) parser throw input bukan array; (15) parser throw elemen bukan objek; (16) parser throw childId hilang.

## Gates (mirror v324-v328)

- npm run build rc 0 (prebuild guard pure-core OK, nihil pattern komersial).
- npx tsc --noEmit rc 0.
- npx eslint kedua berkas rc 0.
- npx vitest dedikasi minimal 14/14 lulus.
- em dash 0 di seluruh diff; lockfile nihil berubah; scope tepat 2 berkas baru.

## Disiplin eksekusi

- Komit dini menit 5-10 (modul dulu, test menyusul), push origin tiap komit.
- Sinkron dulu: git merge origin/develop ke cabang sebelum mulai bila develop maju.
- DILARANG merge sendiri ke develop. Lapor PM pasca push stabil.
