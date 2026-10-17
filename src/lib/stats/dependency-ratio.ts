/**
 * Dependency ratio PBB (v278 fase i): modul PURE untuk rasio ketergantungan
 * standar di atas data anggota hidup, pilar 2 VISION-stemmagraph.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array member menjadi satu angka atau null.
 *
 * Formula World Bank indikator SP.POP.DPND dan SP.POP.DPND.OL (metadata
 * resmi terverifikasi 17 Okt 2026, sumber data UN Population Division
 * WPP): 100 x (populasi 0-14 + populasi 65+) / populasi 15-64.
 *
 * Implementasi memanggil computeAgeGroupsPBB dari age-groups.ts (v269)
 * sehingga logika bucket PBB tidak diduplikasi di modul ini.
 *
 * Semantik output:
 *   Hasil dibulatkan 1 desimal (pola avgLifespanYears v267).
 *   Populasi working-age 15-64 NOL mengembalikan null: pohon kosong
 *   atau pohon tanpa dewasa bukan angka 0 (null-guard pola v267).
 *   Hasil tidak pernah negatif karena semua kelompok tak negatif.
 *
 * Deterministik: nihil randomness, nihil jam tersembunyi di jalur data
 * (now eksplisit bila diinjeksi), urutan input tidak mengubah hasil.
 */

import { computeAgeGroupsPBB, type AgeGroupKey, type AgeGroupsMember } from './age-groups'

export type DependencyRatioMember = AgeGroupsMember

export function computeDependencyRatio(
  members: DependencyRatioMember[],
  now: Date = new Date(),
): number | null {
  const groups: Record<AgeGroupKey, number> = computeAgeGroupsPBB(members, now)
  const dependents = groups['children-0-14'] + groups['seniors-65+']
  const workingAge = groups['adults-15-64']
  if (workingAge === 0) return null
  return Math.round((dependents / workingAge) * 1000) / 10
}
