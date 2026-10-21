# KONTRAK STG V341: DIVORCES-BY-MONTH (FASE I)

Tanggal: 2026-10-21. Penulis: Ardi (pm). Status: KUKUH, siap eksekusi fullstack (Raka).

## 1. Identitas
- Item: v341 divorces-by-month, fase I (modul pure + test).
- Project: Stemmagraph. Cabang: improve/stg-v341-divorces-by-month (DARI develop, sudah dibuat PM).
- Inline: VISION-stemmagraph (statistik silsilah pure-core).

## 2. Jangkar first-hand (wt_statistic.php baris 923)
- getDivorcesByMonth(): translateMonthKeys(divorceRepository->divorcesByMonth()).
- Semantik: perceraian dikelompokkan per bulan 1 sampai 12 (januari sampai desember), dari entri ber-tanggal (dated-only).

## 3. Kontrak modul (src/lib/stats/divorces-by-month.ts)
- Ekspor: computeDivorcesByMonth(entries: unknown): DivorcesByMonthResult.
- Input: array entri { personId: string, divorceDate: string } dengan divorceDate format YYYY-MM-DD.
- Output: { months: number[12] (indeks 0=januari sampai 11=desember, integer non-negatif), total: number, peakMonth: number | null, peakCount: number | null }.
  - peakMonth 1-based (1 sampai 12) agar konsisten kontrak v339 births-by-month, nullable saat total 0.
  - tie peak pilih bulan terkecil.
  - akumulasi per indeks bulan sehingga urutan input tidak memengaruhi hasil.

## 4. Parser strict (ber-index, prefiks divorces-by-month)
Pola persis v339:
1. input bukan array.
2. entri bukan objek (null termasuk).
3. personId hilang atau bukan string.
4. divorceDate hilang atau bukan string.
5. format bukan YYYY-MM-DD, bulan di luar 01 sampai 12, atau tanggal tidak valid kalender (termasuk 29 Feb non-kabisat).
Pesan throw diawali 'divorces-by-month' dan menyebut index entri saat relevan.

## 5. Test vitest (src/lib/stats/divorces-by-month.test.ts)
Minimum 15 kasus, wajib mencakup:
- distribusi dasar 12 bulan; akumulasi multi-entri; urutan input diacak hasil identik; total tepat; peakMonth tie indeks terkecil; peak null saat total 0; input kosong; kelima bentuk throw; bulan 00 dan 13 throw; tanggal tidak valid kalender throw; 29 Feb kabisat valid; prefiks pesan throw via regex.

## 6. Gate QA (identik v339)
- npm ci rc 0; npx vitest run file test (semua pass); npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo); em dash 0; lockfile nihil; scope TEPAT 2 berkas baru + berkas kontrak ini.

## 7. Batas
- DILARANG merge ke develop/main/staging sendiri.
- Dilarang menyentuh main atau staging.
- Tanpa kode komersial (pure core).
