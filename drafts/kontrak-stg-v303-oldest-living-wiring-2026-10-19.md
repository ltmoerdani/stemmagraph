# Kontrak v303-STG-OLDEST-LIVING-WIRING (fase iii)

Repo: stemmagraph. Cabang: improve/stg-v303-oldest-living-wiring (dari develop 4437543).
Visi: Stemmagraph pilar 2 statistik; lanjutan rantai v301 (modul pure) + v302 (API).
Sumber: kandidat backlog draft Sena wake-55, validasi PM wake-57.

## Scope TEPAT 4 berkas, ADD-ONLY pada 3 berkas existing + 1 testfile BARU

1. src/lib/adapters/types.ts: interface OldestLivingEntryDto { id: string; ageYears: number }
   dan method getOldestLiving(treeId: string): Promise<OldestLivingEntryDto[]> di StatsApi.
   Add-only, tanpa mengubah baris existing.
2. src/lib/adapters/rest.adapter.ts: implementasi getOldestLiving pola PERSIS
   getFamilySizeStats (baris 475): this.request('GET',
   /trees/encode(treeId)/stats/oldest-living), error propagate tanpa catch lokal.
3. src/components/Sidebar/StatsSidebar.tsx: state oldestLiving + oldestLivingLoaded
   pola PERSIS family-size (v290): useEffect getStatsApi + getOldestLiving saat
   currentFamilyTreeId ada, cleanup cancelled saat unmount, section render HANYA saat
   oldestLivingLoaded DAN array tidak kosong, setelah section family-size. Tampilkan
   maks 10 entri: peringkat, ageYears angka, tanpa nama (payload server tanpa PII).
   Label i18n locale id + en blok stats.oldestLiving, judul mis. 'Anggota hidup tertua'.
4. src/components/Sidebar/__tests__/StatsSidebar.oldest-living.test.tsx BARU: min 10
   kasus pola persis v290: vi.hoisted store mock, vi.mock adapters index dan i18n
   bundel dua locale; render daftar peringkat 1..N + umur, sukses, kosong tak dirender,
   api null, treeId kosong, fetch gagal, loading awal tak dirender, locale id en.

## Larangan
- TIDAK menyentuh: modul pure v301, route server v302, StatsSidebar bagian existing
  selain add-only state/useEffect/section, schema, lockfile.
- TIDAK merge sendiri. Komit dini menit 5-10, komit granular, push origin cabang.

## Gates (mirror v290 v298)
npm ci; npm run build rc 0 SEBELUM vitest; dedikasi >= 10/10; regresi
src/lib/genealogy + src/lib/stats nihil gagal selain flaky beban (rerun serial wajib);
tsc rc 0; eslint delta rc 0; em dash 0 di semua delta; scope 4 berkas.

## QA R1
Pasca push stabil (tip origin maju dari base) atau ambang salvase 75 menit.
