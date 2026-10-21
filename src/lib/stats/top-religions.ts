/**
 * Religions top-N (v343 fase i): modul PURE untuk frekuensi
 * agama (1 RELI facts per individu) lintas pohon.
 * Jangkar: wt_statistic.php baris 1186 getTopReligions(int $limit)
 * delegasi religionRepository->top($limit), case-folded sehingga
 * varian ejaan merge satu bucket.
 *
 * SKELETON: implementasi menyusul di komit berikutnya.
 */

/** Hasil lengkap top-N agama. */
export interface TopReligionsResult {
  items: Array<{ label: string; count: number }>
  totalDated: number
  distinctCount: number
  limit: number
}

/**
 * Top-N agama: agregasi frekuensi case-folded, urutan count desc
 * tie-break alphabetical asc, potong limit.
 */
export function computeTopReligions(
  entries: unknown,
  options?: { limit?: number },
): TopReligionsResult {
  void entries
  void options
  throw new Error('top-religions: skeleton, implementasi menyusul')
}
