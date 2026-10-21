# KONTRAK V345-STG-FIRST-CHILDREN-BY-MONTH FASE I (2026-10-21)

Project: Stemmagraph. Cabang: improve/stg-v345-first-children-by-month dari origin/develop 829cdf2. PM Ardi wake-111.

## 1. Jangkar

wt_statistic.php baris 1052 sampai 1059: getFirstChildrenByMonth(): array delegasi translateMonthKeys(childrenRepository->firstChildrenByMonth()). Doc comment jangkar resmi: First-children by localised month name. Terverifikasi first-hand PM wake-111 (sed baris 1048 sampai 1062 plus translateMonthKeys baris 1264: kunci singkatan bulan dipetakan ke label, bulan nihil di-nol-kan via ?? 0).

## 2. Anti-dup

git grep firstChildrenByMonth / first-children NIHIL di origin/develop src dan server (first-hand 21 Okt). git log --all -- '*first-children*' NIHIL commit pernah ada (pelajaran insiden v342 diterapkan). births-by-month v339 beda substansi (semua kelahiran, bukan anak pertama per keluarga); divorces-by-month v341 beda event; birth-heatmap beda dimensi. GOAL_HISTORY dan drafts nihil v345.

## 3. Interface (modul src/lib/stats/first-children-by-month.ts)

export interface FirstChildrenRecord { familyId: string; child: { id: string; birthDate: string } }
export interface FirstChildrenByMonthResult { firstChildrenByMonth: number[]; total: number; peakMonth: number | null; peakCount: number; familiesCounted: number }
export function computeFirstChildrenByMonth(records: unknown): FirstChildrenByMonthResult

Input records: array entri, SATU entri per anak, dengan familyId keluarga asal; pemilih anak pertama dilakukan MODUL (bukan pemanggil): dalam tiap familyId, anak pertama = birthDate PALING AWAL (string ISO YYYY-MM-DD urut leksikografis valid untuk tanggal Gregorian tahun 4 digit); tie birthDate identik dalam satu keluarga: ambil entri pertama ditemui, sisanya diabaikan tanpa error.

## 4. Semantik dan parser strict

- records harus array; tiap entri objek { familyId: string; child: objek { id: string; birthDate: string } }; pelanggaran throw Error pesan diawali 'first-children-by-month' dan menyebut index entri.
- birthDate format wajib YYYY-MM-DD pola v339: bukan format, bulan 00 atau 13, hari tidak valid kalender, 29 Feb non-kabisat: throw ber-index.
- firstChildrenByMonth: 12 angka indeks 0 = Januari sampai 11 = Desember, bulan tanpa anak pertama bernilai 0 (mirror translateMonthKeys ?? 0).
- total: jumlah seluruh anak pertama terhitung = familiesCounted (satu per keluarga).
- peakMonth: indeks bulan count tertinggi, tie pilih indeks terkecil, NULL saat total 0; peakCount count bulan itu, 0 saat total 0 (pola nullable v339).
- familiesCounted: jumlah familyId unik yang menyumbang satu anak pertama.
- Deterministik: hasil tidak bergantung urutan input records (pemilihan anak pertama per keluarga via pembanding tanggal, bukan urutan datang, KECUALI tie tanggal identik yang ambil entri pertama ditemui sehingga urutan hanya berpengaruh pada id anak mana yang terpilih, bukan pada distribusi bulan).
- Tanpa I/O, tanpa Date.now, tanpa random.

## 5. Test vitest (src/lib/stats/first-children-by-month.test.ts)

Minimum 15 kasus, wajib mencakup: dasar satu keluarga satu anak pertama masuk bulan lahirnya; multi keluarga terakumulasi; anak kedua dan ketiga TIDAK terhitung (hanya yang paling awal); tie birthDate identik satu keluarga ambil entri pertama; bulan kosong bernilai 0 dan array 12 slot; total dan familiesCounted tepat; peakMonth tertinggi tie pilih indeks terkecil; input kosong: total 0, familiesCounted 0, peakMonth null, peakCount 0; urutan records diacak hasil distribusi identik; input bukan array throw; entri bukan objek throw; familyId bukan string throw; child bukan objek throw; id bukan string throw; birthDate bukan string throw; format salah throw; bulan 00 dan 13 throw; 29 Feb kabisat valid dan non-kabisat throw; prefiks pesan via regex /first-children-by-month/.

## 6. Gate QA (identik v341 v343 v344)

npm ci rc 0; npx vitest run file test semua pass; npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo); em dash 0; lockfile nihil berubah; scope TEPAT 2 berkas baru plus kontrak.

## 7. Batas

DILARANG merge ke develop/main/staging sendiri. Dilarang sentuh main atau staging. Pure core tanpa kode komersial. Branch kerja: improve/stg-v345-first-children-by-month.
