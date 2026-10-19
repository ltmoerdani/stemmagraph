# Kontrak v315-STG-SIBLING-DEATH-CLUSTERS FASE I (modul pure + test)

Tanggal: 2026-10-20. Penyusun: PM Ardi (derivasi mandiri dari VISION Stemmagraph, fallback first-hand pasca improver sync gagal pola delegation depth limit).

## Jangkar (terverifikasi first-hand PM, wt_statistic.php baris 318)

- getSiblingDeathClusters(int $minFamilies = 2): array, mendelegasikan ke familyRepository->getSiblingDeathClusters($minFamilies).
- Doc comment jangkar: tahun ketika beberapa keluarga sekaligus kehilangan anak, sinyal lintas keluarga yang bisa bertepatan dengan mortalitas epidemi, perang, atau kelaparan, berbeda dari tragedi tunggal satu keluarga.
- Item VISION: differensiator data Stemmagraph (statistik genealogis pure, tanpa komersial).

## Anti-dup (diverifikasi PM 20 Okt, wake-74)

- grep siblingdeath, sibling_death, sexratio, sex_ratio, sexRatio di src/ dan server/ NIHIL.
- v315, sibling death, sex ratio NIHIL di GOAL_HISTORY.md.
- Modul U5 child-mortality.ts dan mortality-anomalies.ts (v314 in-flight) beda substantif: keduanya agregat person, bukan cluster lintas keluarga per tahun.
- Kesimpulan: BERSIH, boleh disiapkan. Dispatch SERIAL pasca verdict v314 (anti double-dispatch, preseden v313).

## Scope (2 berkas BARU saja, plus kontrak ini)

1. src/lib/stats/sibling-death-clusters.ts (modul pure, tanpa I/O, tanpa import komersial).
2. src/lib/stats/sibling-death-clusters.test.ts (vitest, 12 sampai 14 kasus).

DILARANG menyentuh berkas lain. DILARANG mengubah lockfile. DILARANG merge sendiri ke develop.

## Spesifikasi perilaku (keputusan desain PM, preseden modul pure v307 sampai v314)

Input: array families { children: Array<{ deathDate: string | null }> }. Child tanpa deathDate diabaikan. Family tanpa cukup data tetap masuk array input, penanganan ada di logika hitung.

Proses:
1. Untuk tiap family, kumpulkan tahun kematian anak dari deathDate (parse ISO, ambil tahun). Child dengan deathDate null atau tidak valid diabaikan.
2. Untuk tiap family dan tiap tahun, hitung jumlah anak yang meninggal di tahun itu. Family berkontribusi pada tahun Y hanya jika jumlah itu >= 2.
3. Agregasi lintas family: per tahun Y, hitung distinct family yang memenuhi syarat langkah 2.
4. Filter: hanya tahun dengan jumlah family >= minFamilies (default 2).
5. Jika input kosong atau tidak ada tahun memenuhi syarat, hasil array kosong, JANGAN throw.
6. Urutan hasil: year menaik (kronologis).
7. Output per entri: { year: number; families: number } dengan families = jumlah distinct family.

Parameter fungsi: computeSiblingDeathClusters(families, options?) dengan options.minFamilies default 2.

## Gates (mirror v312 v313 v314)

- vitest dedikasi modul lulus penuh.
- npm run build rc 0.
- tsc rc 0.
- eslint rc 0 pada berkas baru.
- Em dash nihil di semua berkas baru.
- Lockfile tidak berubah.
- Baseline 12 testfile fail warisan v303 tidak bertambah.

## Parser strict

deathDate tidak valid (bukan pola tanggal) dibiarkan diabaikan tanpa silent filter lintas record lain: abaikan hanya record itu, jangan gagalkan seluruh batch (koreksi QA v308: parser strict lempar Error untuk format yang jelas rusak pada field wajib; deathDate di sini opsional sehingga null sah, format rusak non-null diabaikan per record).
