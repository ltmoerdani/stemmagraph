# KONTRAK V343-STG-TOP-RELIGIONS-TOPN FASE I (2026-10-21)

Project: Stemmagraph. Cabang: improve/stg-v343-top-religions dari origin/develop 291ea5b. PM Ardi wake-110.

## 1. Jangkar

wt_statistic.php baris 1186: getTopReligions(int $limit) delegasi religionRepository->top($limit). Doc comment jangkar: top-N religions / confessions dari 1 RELI facts pada individuals, case-folded sehingga varian ejaan merge satu bucket. Terverifikasi first-hand PM wake-110.

## 2. Anti-dup

git grep religion nihil di origin/develop src server (first-hand 21 Okt). Modul top-occupations (v333) beda substansi (occupations). BOARD dan GOAL_HISTORY nihil v343 maupun religions. Catatan kontekst: v342 mortality-anomalies DIBATALKAN wake-110 karena v314 sudah merged (pelajaran: cek git log --all path dulu sebelum kontrak).

## 3. Interface (modul src/lib/stats/top-religions.ts)

export interface TopReligionsResult { items: Array<{ label: string; count: number }>; totalDated: number; distinctCount: number; limit: number }
export function computeTopReligions(entries: unknown, options?: { limit?: number }): TopReligionsResult

## 4. Semantik dan parser strict

- entries harus array; tiap entri objek { religion: string }; pelanggaran throw Error pesan diawali 'top-religions' dan menyebut index entri.
- options.limit integer >= 1 default 8 (mirror jangkar topN 8 default); invalid throw prefiks sama.
- Normalisasi case-folded: trim + toLowerCase (konsisten v332 v333). String kosong setelah trim: dihitung sebagai seri 'unknown' tunggal terpisah, tidak ikut ranking.
- items: urut count desc, tie alphabetical asc, slice limit, label lowercase.
- totalDated: jumlah entri ber-string non-kosong. distinctCount: jumlah bucket unik non-kosong.
- Deterministik: nihil randomness, nihil jam sistem.

## 5. Test vitest (src/lib/stats/top-religions.test.ts)

Minimum 15 kasus, wajib mencakup: dasar agregasi; case-folded merge varian ejaan; urutan count desc; tie alphabetical asc; limit memotong; limit custom; limit invalid throw; input kosong; string kosong masuk unknown terpisah tidak masuk ranking; lima bentuk throw (entries bukan array, entri bukan objek, religion bukan string, dengan index di pesan); prefiks pesan via regex /top-religions/; distinctCount tepat; totalDated tepat.

## 6. Gate QA (identik v341)

npm ci rc 0; npx vitest run file test semua pass; npm run build rc 0; npx tsc --noEmit rc 0; eslint KEDUA file item rc 0 (JANGAN lint full repo); em dash 0; lockfile nihil berubah; scope TEPAT 2 berkas baru plus kontrak.

## 7. Batas

DILARANG merge ke develop/main/staging sendiri. Dilarang sentuh main atau staging. Pure core tanpa kode komersial.
