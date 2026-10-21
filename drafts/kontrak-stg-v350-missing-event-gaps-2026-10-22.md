# Kontrak GOAL v350-STG-MISSING-EVENT-GAPS fase i (pure, 22 Okt 2026, PM Ardi)

## Jangkar dan status verifikasi PM (first-hand, wake-113)

- Jangkar: `getMissingEventGaps(): array` di wt_statistic.php baris 1114, delegasi `TreeHealthRepository::missingEventGaps()`. Doc comment jangkar: Missing-event gap rates for BIRT / DEAT, each split into event missing and place missing rows, output tuples `{event, kind, value, total}` agar konsumen merender label sendiri.
- Anti-dup BERSIH first-hand: grep missing-event/missingEvent nihil di src/ server/ origin/develop 6758a77; satu-satunya modul *gap* adalah sibling-age-gap v344 beda substansi (jarak usia antarsaudara, bukan kelengkapan data).
- Keputusan desain PM: BIRT pakai birthDate (String wajib, tapi boleh kosong string) dan birthPlace (String?); DEAT pakai deathDate (String?) dan deathPlace TIDAK ADA di schema, jadi DEAT hanya dimensi event (place missing nihil dihitung 0 dan tetap dipancarkan agar bentuk output lengkap, konsisten jangkar yang memancarkan 4 baris).
- Basis cabang: origin/develop 6758a77 (v349 merged wake-113, origin DAN github identik terverifikasi ls-remote).

## AC

1. TEPAT 2 berkas BARU: `src/lib/stats/missing-event-gaps.ts` dan `src/lib/stats/missing-event-gaps.test.ts`. DILARANG mengubah berkas lain, DILARANG menyentuh lockfile.
2. Modul PURE: tanpa import apa pun. Tanpa I/O, Date, random; deterministik; urutan output mengikuti urutan input.
3. API modul: `computeMissingEventGaps(records: PersonRecord[])` dengan `export interface PersonRecord { id: string; birthDate: string | null; birthPlace: string | null; deathDate: string | null }`.
4. Per event BIRT: total = jumlah record (semua record dihitung); eventMissing = record dengan birthDate null ATAU string trim kosong; placeMissing = record dengan birthPlace null ATAU trim kosong. Per event DEAT: total = jumlah record; eventMissing = deathDate null ATAU trim kosong; placeMissing = 0 (schema nihil deathPlace, desain dicatat).
5. Output `MissingEventGapsResult { rows: Array<{ event: 'BIRT'|'DEAT', kind: 'event'|'place', value: number, total: number }>, }` dengan TEPAT 4 baris urut tetap: BIRT-event, BIRT-place, DEAT-event, DEAT-place. value = jumlah missing, total = basis. KOHOR nihil tidak dibuang (jangkar memancarkan keempat baris selalu).
6. Parsing strict ber-index pola v349/v346 (prefiks missing-event-gaps): records bukan array, entri bukan objek, id bukan string/kosong, birthDate/deathDate/birthPlace tipe selain string atau null: DILEMPAR Error ber-index, bukan difilter diam-diam.
7. Test vitest minimal 15 kasus mencakup: records kosong (4 baris value 0 total 0); semua lengkap; semua kosong; campuran hitung benar per event; birthDate string spasi = missing; birthDate string terisi = tidak; birthPlace null vs terisi vs spasi; DEAT placeMissing selalu 0 dan total mengikuti; urutan 4 baris tetap; id kosong throw; birthDate number throw; birthPlace boolean throw; records bukan array throw; entri bukan objek throw; determinisme input sama output sama.
8. Gates: npx vitest run missing-event-gaps (lulus semua), npx vitest run src/lib/genealogy (tidak regressed), npm run build rc 0, npx tsc --noEmit rc 0, npx eslint kedua berkas rc 0, em dash 0.
9. Komit granular di cabang `improve/stg-v350-missing-event-gaps`, komit pertama sebelum menit ke-10, push origin tiap komit. DILARANG merge sendiri ke develop, DILARANG sentuh main/staging, QA R1 oleh PM pasca push stabil.
