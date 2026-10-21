# KONTRAK STG V340: RESIDENCES-BY-COUNTRY (FASE I)

Tanggal: 2026-10-21. Penulis: Ardi (pm). Status: KUKUH, siap eksekusi fullstack (Raka).

## 1. Identitas
- Item: v340 residences-by-country, fase I (modul pure + test).
- Project: Stemmagraph. Cabang: improve/stg-v340-residences-by-country (DARI develop, sudah dibuat PM).
- Inline: VISION-stemmagraph (statistik silsilah pure-core, sisi server hanya read-only).

## 2. Jangkar first-hand (wt_statistic.php baris 453)
- getResidencesByCountry(): delegasi ke countryRepository->residencesByCountry().
- Semantik: tiap kemunculan 1 RESI pada individu dihitung SEKALI per negara; satu orang dengan tiga tempat tinggal (mis. Jerman, AS, Prancis) tercatat di KETIGA negara.
- Artinya bukan dedupe per orang penuh, melainkan dedupe pasangan (personId, negara): satu orang boleh menyumbang beberapa negara, tapi satu pasangan orang+negara hanya dihitung sekali.

## 3. Kontrak modul (src/lib/stats/residences-by-country.ts)
- Ekspor: computeResidencesByCountry(entries: unknown): ResidencesByCountryResult.
- Input: array entri seperti pola v338/v339: { personId: string, residences: string[] }.
  - residences berisi kode atau label negara (string) per kemunculan 1 RESI.
- Output: { countries: Array<{ country: string, count: number }>, totalEntries: number, uniquePersons: number, totalResidences: number }.
  - countries urut alfabetis naik by country (deterministik), count = jumlah pasangan unik (personId, country).
  - totalResidences = jumlah semua count (pasangan unik), BUKAN jumlah kemunculan mentah.
  - totalEntries = panjang input valid; uniquePersons = banyak personId unik.

## 4. Parser strict (ber-index, prefiks residences-by-country)
Lima bentuk throw wajib, pola persis v338/v339:
1. input bukan array.
2. entri bukan objek (null termasuk).
3. personId hilang atau bukan string.
4. residences hilang atau bukan array.
5. elemen residences bukan string (pesan menyebut index).
Pesan throw diawali 'residences-by-country' dan menyebut index entri saat relevan.

## 5. Dedupe
- Gunakan Set kunci `${personId}\u0000${country}` untuk pasangan unik.
- Negara string apa pun valid (tidak ada whitelist); string kosong BOLEH dihitung sebagai negara (perilaku jangkar: RESI tanpa negara tetap entri negara itu, tetap konsisten: satu pasangan sekali).

## 6. Test vitest (src/lib/stats/residences-by-country.test.ts)
Minimum 15 kasus, wajib mencakup:
- distribusi dasar multi-negara; satu orang 3 negara masuk ketiganya; dedupe pasangan sama (orang sama negara sama dua entri) dihitung 1; urutan input diacak hasil identik; totalEntries dan uniquePersons tepat; totalResidences = sum count; urutan alfabetis countries; input kosong negara 0; kelima bentuk throw (non-array, entri bukan objek, personId hilang, residences hilang, elemen bukan string ber-index); prefiks pesan throw via regex; string kosong sebagai negara valid.

## 7. Gate QA (identik v338/v339)
- npm ci rc 0; npx vitest run file test (semua pass); npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo, lambat); em dash 0 di semua commit dan berkas; lockfile nihil; scope TEPAT 2 berkas baru + berkas kontrak ini.

## 8. Batas
- DILARANG merge ke develop/main/staging sendiri (merge hanya perintah PM pasca QA lulus).
- Dilarang menyentuh main atau staging.
- Tanpa kode komersial (pure core).
