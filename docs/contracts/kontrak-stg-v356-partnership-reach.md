# Kontrak V356-STG-PARTNERSHIP-REACH Fase I (modul PURE)

Project: Stemmagraph. Pilar: statistik pohon (pilar 2 VISION-stemmagraph). Tanggal: 2026-10-22.
Cabang kerja: `improve/stg-v356-partnership-reach` dari origin/develop 77bd1c5. Tipe: ADD-ONLY 2 berkas baru (modul + test) plus kontrak ini di cabang.

## Jangkar

magicsunday/webtrees-statistics (open-source, GPL-3.0) `src/Support/Calc/PartnershipChains.php` diakses web_fetch 22 Okt 2026: modul pure PHP yang memecah adjacency partnership graph (`xref => [spouse xref...]`, edge FAMS) menjadi connected components, hanya komponen dengan MIN_GROUP_SIZE = 3 orang yang dilaporkan (pasangan tunggal bukan rantai). `largestGroup()` mengembalikan members byte-order sorted plus edges = jumlah degree / 2. `longestChain()` menghitung diameter komponen via DOUBLE BFS dengan determinisme penuh: BFS pertama dari node xref terkecil, endpoint terjauh tie-break xref byte-order terkecil, path dinormalisasi orientasi leksikografis, antar komponen sepanjang sama menang urutan xref leksikografis terkecil. `highestDegreeMember` (di PartnershipReachRepository.php) memilih hub derajat tertinggi dengan tie-break xref terkecil. Bukti sumber tersimpan notes/research-084.

## Anti-dup (diverifikasi first-hand PM 22 Okt)

Grep `partnership-reach|partnershipReach|hubDegree|hub-degree|longestChain|longest-chain` NIHIL di src/ server/ docs/ GOAL_HISTORY.md drafts. Beda substantif dari: v298 most-influential-ancestors (peringkat leluhur per jumlah keturunan transitif di graph orangtua-anak), v300 top-largest-families dan top-grandchild-families (ranking keluarga per anak dan cucu), family-size-stats (distribusi ukuran keluarga inti), v354 family-status (status per anggota). Partnership graph pasangan-suami-istri dengan connected component, diameter path, dan hub degree belum ada.

## Spesifikasi modul PURE `src/lib/stats/partnership-reach.ts`

- Input: `pairs: PartnershipPair[]` dengan `{ pairId: string; a: string; b: string }` (id pasangan plus dua id anggota). Modul membangun adjacency simetris internal dari pasangan, tanpa import eksternal, tanpa I/O, tanpa Date.now, deterministik.
- Parser strict pola v355: bentuk pair salah (bukan objek, pairId/a/b bukan string, a sama dengan b) LEMPAR `Error` ber-prefiks `partnership-reach` ber-index. Duplikasi pairId LEMPAR juga. Duplikasi edge sama (a-b sama tak peduli urutan) didedupe diam-diam (hitung 1 edge).
- Pasangan dengan anggota tidak muncul di pasangan lain tetap sah node ber-degree 1.
- Connected components: BFS iteratif explicit queue, hanya komponen minimal 3 orang masuk hasil. Members tiap komponen terurut byte-order naik. Daftar komponen terurut member count menurun, tie-break xref terkecil.
- Output: `{ largestGroup: { members: string[]; edges: number; hubId: string; hubDegree: number; longestChain: string[] } | null; componentCount: number }`. Nihil komponen lolos ambang: `largestGroup` null, `componentCount` 0, tanpa throw.
- edges = jumlah degree member / 2 (integer). hub = member degree tertinggi di komponen terbesar, tie-break id byte-order terkecil. longestChain = diameter path komponen terbesar via double BFS deterministik pola jangkar: BFS 1 dari member terkecil mencari endpoint terjauh (tie-break id terkecil), BFS 2 dari endpoint itu mencari jarak maksimum, kandidat path di-rekonstruksi lewat parent map, dinormalisasi orientasi (bandingkan dengan reverse, simpan yang leksikografis lebih kecil), antar kandidat sepanjang sama pilih urutan id terkecil. Cap panjang path 100 sebagai pengaman.
- `componentCount` menghitung SEMUA komponen yang lolos ambang 3, bukan hanya terbesar.
- Test vitest `partnership-reach.test.ts` minimal 16 kasus: happy path rantai tunggal, ambang 3 orang (komponen 2 orang ditolak), dua komponen terbesar menang, tie komponen sama besar pilih xref terkecil, edges hitung benar pada graf bintang, hub pilih degree tertinggi, hub tie id terkecil, longestChain rantai lurus, longestChain cabang Y pilih diameter, normalisasi orientasi path (mirror sama hasil), determinisme urutan input acak, parser throw prefiks pair bukan objek, parser throw a sama b, parser throw duplikat pairId, dedupe edge ganda, input kosong.

## Gates (mirror v349 sampai v355)

`npm ci`, `npm run build` (vite, tanpa DATABASE_URL), `npm run lint`, `npx tsc --noEmit`, vitest dedikasi lulus penuh, regresi `src/lib/stats` tidak menurunkan baseline, em dash 0 di semua berkas, lockfile dan package.json nihil berubah, guard pure-core lulus. DILARANG merge sendiri ke develop.
