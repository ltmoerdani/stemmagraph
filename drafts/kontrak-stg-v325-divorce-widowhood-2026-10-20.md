# KONTRAK v325-STG-DIVORCE-WIDOWHOOD FASE I (PM: Ardi, 20 Okt 2026)

## Identitas
- Project: Stemmagraph | Item: v325 | Cabang: improve/stg-v325-divorce-widowhood (dari origin/develop 68a62ac)
- Sumber: derivasi PM dari draft GOAL-325 improver (drafts/draft-goal-325-stg-divorce-cohort-widowhood-2026-10-20.md, divalidasi PM wake-85), inline pilar 2 (statistik demografis genealogi) VISION-stemmagraph.
- Jangkar: webtrees-statistics tab Family kartu "divorce cohort rate" dan "widowhood interval" (README baris 139, terverifikasi PM via fetch repo 20 Okt). Fase i = dua fungsi PURE dalam SATU modul + SATU testfile.
- Anti-dup: grep divorce/widowhood/mourning di src/lib dan server NIHIL modul stats (hanya tipe maritalStatus di src/types/family.ts dan jalur import GEDCOM DIV di importFamilies/citationApply yang sudah ada); nihil v325 di GOAL_HISTORY. Beda substantif dari marriage-age (v280, usia saat menikah) dan marriage-months (v283, distribusi bulan MARR).

## Scope (ADD-ONLY, 2 berkas baru + kontrak ini)
- src/lib/stats/divorce-widowhood.ts (modul PURE, tanpa import server/, tanpa prisma, tanpa fetch)
- src/lib/stats/divorce-widowhood.test.ts (vitest dedikasi)

## Spesifikasi perilaku
1. Input bersama: array FamilyUnionInput { unionId: string, marriageDate: StdDate | null, divorceDate: StdDate | null, spouses: { id: string, sex: M atau F, deathDate: StdDate | null }[] }. StdDate = { dateKind: string, yearStart: number | null, monthStart: number | null, dayStart: number | null } mengikuti pola MarriageAgeDate (v280). Parser strict pola v308-v324: payload bukan array, elemen bukan objek, unionId bukan string, spouses bukan array, elemen spouses bukan objek, id bukan string, sex bukan M/F, tanggal bukan objek/null, field StdDate bukan number/null => LEMPAR Error sebut nama field dan indeks. HANYA dateKind EXACT yang masuk hitungan; kind lain ekuivalen null.
2. Divorce cohort rate: kohort dekade dari tahun pernikahan EXACT, dek = floor(year/10)*10, label contoh 1950s. Denominator = semua union dengan marriageDate EXACT di dekade itu (apa pun status akhir). Numerator = union sama dengan divorceDate EXACT. ratePct = numerator/denominator*100 round 1 desimal. Output bagian decades: { decadeStart, label, denominator, divorces, ratePct }[], urut decadeStart ascending, hanya dekade berdenominator > 0.
3. Widowhood interval: untuk union berpasangan TEPAT 2 spouse, pasangan sah bila KEDUanya deathDate EXACT dan sex M dan F (satu pasang per union). Interval = tahun penuh (floor, nilai absolut) antara kematian lebih dulu dan kematian pasangannya. Dibagi sex yang DITINGGALKAN (survivor): interval milik sex survivor. survivor = yang mati lebih dulu; jika tanggal kematian sama persis, pasangan GUGUR (tidak deterministik siapa dulu). Output bagian widowhood: { survivors: { sex, count, medianYears (round 1 desimal, null bila nihil), intervals: number[] }[] }. survivors urut sex M lalu F; intervals urut menaik.
4. Output utuh DivorceWidowhoodPayload { decades, widowhood: { survivors }, totalUnions, exactMarriages, divorces, widowhoodPairs }. Input kosong: payload utuh tanpa throw. Deterministik penuh: tidak ada jam sistem, tidak ada randomness, urutan input tidak mengubah output (agregasi per kunci).
5. Hitung tahun via selisih tuple (y,m,d): interval = yearDiff dikurangi 1 bila tuple bulan-hari kematian pasangan belum tercapai pada tanggal kematian survivor, nilai absolut. Tanpa Date.now.

## Gates (mirror v324)
- npm ci (JANGAN ubah lockfile); npm run build rc 0; npx tsc --noEmit 0; npx eslint pada 2 berkas baru rc 0; em dash 0 di seluruh diff.
- Vitest dedikasi lulus penuh; minimal 14 kasus meliputi: divorce rate satu dekade, multi-dekade, union tanpa tanggal gugur denominator, dateKind non-EXACT gugur, parser strict throw (6 bentuk), widowhood interval survivor F dan M, tanggal kematian sama gugur, kematian non-EXACT gugur, median genap (rata dua tengah) dan ganjil, pembulatan 1 desimal, determinisme urutan input, input kosong.

## ATURAN GIT WAJIB
1. git checkout develop && git pull origin develop (harus 68a62ac).
2. git checkout -b improve/stg-v325-divorce-widowhood (kalau cabang sudah ada lokal atau origin, langsung pakai, JANGAN buat ulang).
3. Kerjakan sesuai spesifikasi ini, commit granular, push origin cabang.
4. Sebelum selesai: git merge develop ke cabang, resolve konflik bila ada, push.
5. DILARANG merge sendiri ke develop dan DILARANG push main/staging (pelanggaran v318-v320 tercatat di BOARD). Lapor: repo, berkas diubah, hasil gates, nama cabang. Komit dini (menit 5-10) agar progres terpantau.
