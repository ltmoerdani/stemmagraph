# KONTRAK v323-STG-DEATH-BOXPLOT FASE I (PM: Ardi, 20 Okt 2026)

## Identitas
- Project: Stemmagraph | Item: v323 | Cabang: improve/stg-v323-death-boxplot (dari origin/develop 224fdea)
- Sumber: draft GOAL-323 Sena (drafts/draft-goal-323-age-death-boxplot-2026-10-20.md), tervalidasi PM.
- Jangkar: pola Life span modul webtrees-statistics (boxplot per abad lazim); jangkar PHP terdekat getAgeAtDeathDistribution (wt_statistic.php baris 464, band dekade) dan getAverageLifespanBySexAndCentury (baris 473, kohort abad). v323 = distribusi kuartil per kohort abad, pelengkap v322 (rerata) dan v299 (band dekade).
- Anti-dup: grep boxplot/quartile nihil di src/lib/stats dan server; nihil v323 di GOAL_HISTORY. v299 beda substantif (band hitung frekuensi dekade), v322 beda (rerata per sex), v307 survival curve beda (proporsi hidup).

## Scope (ADD-ONLY, 2 berkas baru + kontrak ini)
- src/lib/stats/death-boxplot.ts (modul PURE, tanpa import server/, tanpa prisma, tanpa fetch/jaringan)
- src/lib/stats/death-boxplot.test.ts (vitest dedikasi)

## Spesifikasi perilaku
1. Input: array DeathEntry { sex: M|F|U|null, birthYear: number|null, deathYear: number|null } (mirror pola v322 LifespanEntry).
2. Parser strict pola v308 s.d. v322: bentuk payload salah (bukan array, elemen bukan objek, sex di luar enum, tahun bukan number/null) LEMPAR Error dengan nama field dan indeks. Data invalid SAH dihitung counter: tahun null, birthYear <= 0 (guard BCE), deathYear < birthYear -> invalidLifespans. Umur 0 sah.
3. Umur = deathYear - birthYear (integer sederhana, tanpa koreksi anniversary, konsisten v322). Abad kohort dari tahun LAHIR: floor(birthYear/100)*100, label "<start>-<start+99>" (konsisten v322).
4. MIN_SAMPLES = 10. Sel abad dengan sampel < 10: kelima statistik null (min,q1,median,q3,max), sampleSize tetap dicantumkan.
5. Kuartil metode interpolasi linear R tipe 7 (deterministik, ditetapkan kontrak): sort samples ascending; posisi h = (n-1)*p; lower = floor(h); frac = h - lower; value = arr[lower] + frac * (arr[lower+1] - arr[lower]) dengan clamp indeks ke [0, n-1]. q1 p=0.25, median p=0.5, q3 p=0.75. min/max = elemen pertama/terakhir tanpa interpolasi.
6. Output DeathBoxplotPayload { centuries: { start:number, label:string }[], cells: { centuryStart, label, min, q1, median, q3, max, sampleSize }[], validLifespans, invalidLifespans, excludedUnknown }. Sex U/null di-skip dari sel dan dihitung excludedUnknown (konsisten v322). Hanya abad berminimal 1 sampel valid muncul di cells, urut centuryStart ascending. Input kosong: payload utuh tanpa throw.
7. Deterministik: sort ascending sebelum kuartil; urutan input tidak mengubah output; nihil randomness, nihil jam sistem.

## Gates (mirror v322)
- npm ci (JANGAN ubah lockfile); npm run build rc 0; npx tsc --noEmit 0; npx eslint pada 2 berkas baru rc 0; em dash 0 di seluruh diff.
- Vitest dedikasi lulus penuh; minimal 14 kasus meliputi: guard sampel (9 vs 10), bucketing abad boundary (1899/1900/1901, 2000), n ganjil dan genap, kuartil R tipe 7 hand-computed, outlier tidak menggeser median, parser strict throw, counter invalid/excludedUnknown, determinisme urutan input, input kosong.

## ATURAN GIT WAJIB
1. git checkout develop && git pull origin develop (harus 224fdea).
2. git checkout -b improve/stg-v323-death-boxplot.
3. Kerjakan sesuai spesifikasi ini, commit granular, push origin cabang.
4. Sebelum selesai: git merge develop ke cabang, resolve konflik bila ada, push.
5. DILARANG merge sendiri ke develop dan DILARANG push main/staging. Lapor: repo, berkas diubah, hasil gates, nama cabang. Komit dini (menit 5-10) agar progres terpantau.
