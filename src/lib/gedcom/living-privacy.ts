/**
 * Resolusi privacy status awal untuk anggota yang baru diimpor dari GEDCOM.
 *
 * Modul PURE: tanpa import eksternal, tanpa efek samping, mudah dites.
 * Dipakai pipeline import untuk menurunkan status privasi sebelum data
 * masuk ke export gate yang sudah ada.
 */

export interface LivingPrivacyInput {
  privacyStatus?: 'shared' | 'private';
  livingSuggested?: boolean;
}

/**
 * Aturan resolusi:
 *
 * 1. privacyStatus eksplisit ('shared' atau 'private') SELALU menang utuh,
 *    apa pun nilai livingSuggested. Nilai dari plan import dihormati.
 * 2. Bila privacyStatus kosong dan livingSuggested === true, hasilnya
 *    'private'. Ini safe default anggap-hidup.
 *
 *    Preseden: webtrees melakukan hal serupa. Individu tanpa catatan kematian
 *    (tag DEAT) diperlakukan sebagai orang hidup secara konservatif, lalu
 *    datanya disembunyikan dari pengunjung yang tidak berwenang.
 *
 *    Arah produk: VISION gap 3, consent lintas generasi. Anggota hidup yang
 *    diimpor tanpa sinyal kematian tidak boleh bocor publik sebelum pemilik
 *    data memberikan persetujuan. Default 'private' memastikan data tetap
 *    aman, dan bisa dilonggarkan ke 'shared' lewat alur consent nanti.
 *
 * 3. Selain itu (deceased atau tanpa sinyal apa pun) hasilnya undefined.
 *    Pemanggil membiarkan kolom NULL di database. Export gate yang sudah ada
 *    sudah meredact anggota hidup berstatus NULL, jadi NULL di sini aman.
 */
export function resolveInitialPrivacyStatus(
  input: LivingPrivacyInput,
): 'shared' | 'private' | undefined {
  if (input.privacyStatus === 'shared' || input.privacyStatus === 'private') {
    return input.privacyStatus;
  }

  if (input.livingSuggested === true) {
    return 'private';
  }

  return undefined;
}
