# KONTRAK V319-STG-MIGRATION-DISTANCE-DISTRIBUTION (Fase I)

Pemberi kerja: PM Ardi. Penerima: fullstack (Raka). Cabang: improve/stg-v319-migration-distance (dari origin/develop 2e47605). Repo: /home/zeroclaw/projects/stemmagraph. Tanggal: 2026-10-20.

## 1. Jangkar
wt_statistic.php baris 638: getMigrationDistanceDistribution() delegasi ke PlaceDispersionRepository::getMigrationDistanceDistribution(). Distribusi jarak migrasi lintas generasi. Anti-dup terverifikasi PM 20 Okt: nihil modul migration-distance di src/ dan server/.

## 2. Scope
Dua berkas baru saja (dilarang sentuh berkas lain, lockfile, package.json, prisma schema):
1. src/lib/stats/migration-distance.ts (modul pure, tanpa import DB/IO)
2. src/lib/stats/migration-distance.test.ts (vitest)

## 3. Spesifikasi perilaku (preskriptif, wajib persis)
Input: array pasangan lokasi MigrationDistancePair { originLat, originLon, destLat, destLon }.
1. Validasi parser strict pola v308/v318: elemen bukan objek, field hilang, atau tipe bukan number: lempar Error dengan nama field dan indeks elemen. DILARANG silent-filter pada level parser.
2. Pasangan dengan nilai di luar domain geografis (lat di luar [-90, 90], lon di luar [-180, 180], atau NaN/Infinity): di-skip dari distribusi, dihitung sebagai invalid. Ini bukan parse error, ini data invalid sah.
3. Jarak: haversine, radius bumi R = 6371 km, hasil dibulatkan ke integer km terdekat (Math.round). Guard antimeridian otomatis dari rumus haversine, tanpa penanganan khusus tambahan.
4. Band (desain internal, km): '0' (tepat 0 km), '1-50', '51-200', '201-500', '501-1000', '1000+'. Konstanta publik MIGRATION_DISTANCE_BANDS pola COUPLE_AGE_GAP_BANDS (as const).
5. Output: { bands: Record<Band, number>, validPairs: number, invalidPairs: number }. SEMUA band hadir walau hitungan 0, urutan kunci sesuai urutan konstanta.
6. Array input kosong: kembalikan bands semua 0, validPairs 0, invalidPairs 0, tanpa throw.
7. Boundary band inklusif kiri eksklusif kanan: jarak 50 masuk '1-50', jarak 50.4 setelah round 50 masuk '1-50', jarak 200 masuk '51-200', dst. Jarak 0.4 round 0 masuk '0'.

## 4. Test wajib (vitest, minimal kasus ini)
1. Haversine kasus diketahui: Jakarta (-6.2, 106.816666) ke Bandung (-6.914722, 107.609722) kira-kira 150 km, assert dalam rentang 120 sampai 180.
2. Kasus eksak 0 km (origin sama destination): masuk band '0'.
3. Boundary tiap band: tepat 50, 51, 200, 201, 500, 501, 1000, dan 1001 km kira-kira (boleh triangulasi via pasangan koordinat sintetis di ekuator, 1 derajat lon kira-kira 111.19 km).
4. Nilai invalid: NaN, Infinity, lat 91, lon -181, masing-masing terhitung invalidPairs dan tidak masuk bands.
5. Parser strict: field hilang, field string, elemen non-objek: masing-masing lempar Error.
6. Array kosong: semua band 0 tanpa throw.
7. Determinisme: dua kali panggil input sama hasil identik.
8. Semua band hadir walau 0.

## 5. Gates (mirror v312 sampai v318, wajib lulus sebelum push)
1. npx vitest run src/lib/stats/migration-distance.test.ts: semua lulus.
2. npm run build: rc 0. 3. npx tsc --noEmit: rc 0. 4. npx eslint kedua berkas: rc 0.
5. Regresi ringan: npx vitest run src/lib/stats/couple-age-gap.test.ts tetap lulus.
6. Em dash: NIHIL di kedua berkas (grep karakter U+2014 hasil nihil).
7. Baseline 12 testfile fail warisan v303 tidak boleh bertambah; testfile fail flaky beban (children-per-family-api, citation-coverage-api, upcoming-anniversaries) terdokumentasi, bukan tanggung jawab item ini.

## 6. Alur kerja GIT WAJIB
1. git fetch origin. 2. Branch improve/stg-v319-migration-distance sudah ada di origin berisi komit kontrak ini (tip kontrak): git checkout improve/stg-v319-migration-distance && git pull origin improve/stg-v319-migration-distance. 3. Kerjakan di cabang itu: komit granular, komit pertama paling lambat menit 10 sejak mulai. 4. git push origin improve/stg-v319-migration-distance. 5. Lapor: repo, berkas diubah, hasil gates, tip commit hash.

## 7. Larangan
DILARANG merge ke develop sendiri (merge wewenang PM/verdict QA). DILARANG sentuh main, staging, berkas di luar scope butir 2. DILARANG mengubah kontrak ini.

## 8. QA R1
Setelah push stabil atau 75 menit sejak dispatch tanpa karya: QA R1 oleh PM di tip origin: gates diulang, scope dicek, barulah merge no-ff ke develop.
