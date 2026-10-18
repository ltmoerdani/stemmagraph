# KONTRAK v301-STG-OLDEST-LIVING FASE I (PURE)

Project: Stemmagraph. Cabang: improve/stg-v301-oldest-living (dari origin/develop 1bd0558). Executor: fullstack (Raka). QA R1 oleh PM pasca push stabil atau ambang salvase 75 menit tanpa push. DILARANG merge sendiri.

## Scope TEPAT 2 berkas BARU

1. src/lib/stats/oldest-living.ts: modul pure, NOL import eksternal, NOL import dari src lain.
2. src/lib/stats/oldest-living.test.ts: vitest, MINIMAL 12 kasus eksplisit.

## API wajib

```ts
export interface OldestLivingMember {
  id: string
  birthDate: string | null   // YYYY-MM-DD, pola parser strict living-stats
  isAlive: boolean
}
export interface OldestLivingEntry {
  id: string
  ageYears: number
}
export function computeOldestLiving(
  members: OldestLivingMember[],
  topN?: number,   // default 10
  now?: Date,      // default new Date(), diinjeksi demi determinisme
): OldestLivingEntry[]
```

## AC

1. Kandidat = isAlive true DAN birthDate tidak null dan terparse valid kalender (parser strict YYYY-MM-DD, tolak 2026-02-30 dan format lain, pola living-stats.ts baris 61 Ymd).
2. Umur = penuh tahun anniversary-aware: tahun(now) minus tahun(lahir), dikurangi 1 bila ulang tahun belum lewat tahun ini (banding bulan lalu hari). Kasus tepat ulang tahun masuk usia baru.
3. Urutan: ageYears DESC, tie-break birthDate ASC (lebih tua lahir duluan), lalu id ASC leksikograf. Deterministik penuh.
4. topN default 10; topN <= 0 menghasilkan array kosong; topN memotong hasil.
5. Tanpa side effect, tanpa Date.now() langsung di dalam fungsi (now diinjeksi atau default satu kali di awal).

## Kasus uji wajib (min 12)

Kosong; semua meninggal; birthDate null dikecualikan; birthDate invalid dikecualikan; umur tepat ulang tahun; belum ulang tahun (minus 1); kabisat 29 Feb lahir; urutan DESC; tie umur diecah tanggal lahir; tie penuh dipecah id; topN default 10 dengan 12 kandidat; topN 0 dan negatif kosong; topN 1.

## Larangan

Sentuh file lain, family-graph, living-stats existing, schema, storage, server, StatsSidebar, lockfile. Wiring UI dan label i18n FASE II terpisah. Addendum privasi fase wiring: endpoint fase ii wajib gate member-only (jangkar webtrees Auth::isMember pada varian alive, evidence wake-52) dan data living tunduk privacyStatus.

## Gates (mirror v300)

npm ci; npm run build rc 0 SEBELUM vitest; tsc rc 0; eslint rc 0; vitest dedikasi 12+ lulus; regresi src/lib/genealogy 2106/2106 nihil; em dash 0 di seluruh diff; guard pure core 0 hit. Commit granular min 2 (modul lalu test) dan push origin cabang.
