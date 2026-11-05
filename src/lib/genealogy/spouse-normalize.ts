/**
 * GOAL v419 fase 2 AC3: normalisasi on-read relasi pasangan.
 *
 * spouseIds adalah sumber kebenaran relasi pasangan (AC1); spouseId legacy
 * tetap diisi sebagai elemen pertama spouseIds demi backward-compat (AC2).
 * Data lama yang hanya menyimpan spouseId (pra multi-pasangan) tetap terbaca:
 * saat dibaca, spouseIds dibentuk dari spouseId (migrasi on-read).
 *
 * Fungsi di sini murni, tanpa I/O, dan idempoten: hasil normalisasi
 * dilewati normalisasi ulang tanpa perubahan.
 */

export interface SpouseFields {
  spouseIds?: string[];
  spouseId?: string;
}

/**
 * Turunkan pasangan { spouseIds, spouseId } dari kumpulan id pasangan.
 * Urutan input dipertahankan (dedup via Set), elemen pertama menjadi
 * spouseId legacy. Kosong menghasilkan kedua field undefined.
 */
export function deriveSpouseFields(ids: readonly (string | undefined)[]): SpouseFields {
  const cleaned = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  const deduped = [...new Set(cleaned)];
  if (deduped.length === 0) return {};
  return { spouseIds: deduped, spouseId: deduped[0] };
}

interface SpouseCarrier {
  id: string;
  spouseId?: string;
  spouseIds?: string[];
}

/**
 * Normalisasi satu anggota keluarga agar invariant AC2 terpenuhi.
 *
 * Aturan:
 * 1. id kosong dan self-loop (id = id anggota) dibuang dari spouseIds.
 * 2. Data lama tanpa spouseIds tapi punya spouseId: spouseIds = [spouseId].
 * 3. spouseId hasil turunan selalu elemen pertama spouseIds, termasuk
 *    memperbaiki data rusak yang kedua fieldnya tidak sinkron.
 * 4. Kedua field kosong: keduanya undefined (bukan array kosong).
 *
 * Field lain diteruskan apa adanya; input tanpa masalah keluar identik.
 */
export function normalizeSpouseIds<T extends SpouseCarrier>(member: T): T {
  const fromList = Array.isArray(member.spouseIds) ? member.spouseIds : [];
  const fromLegacy =
    !Array.isArray(member.spouseIds) && typeof member.spouseId === 'string'
      ? [member.spouseId]
      : [];
  const candidates = [...fromList, ...fromLegacy].filter(
    (id) => typeof id === 'string' && id.length > 0 && id !== member.id,
  );

  const { spouseIds, spouseId } = deriveSpouseFields(candidates);

  if (spouseIds === member.spouseIds && spouseId === member.spouseId) {
    return member;
  }
  return { ...member, spouseId, spouseIds };
}
