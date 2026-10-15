/**
 * Guard polisemi terpusat untuk resolveAlias (v254).
 *
 * Memblock frasa majemuk idiom, homograf non-relasi, dan turunan non-relasi
 * SEBELUM lookup map kekerabatan. Modul PURE: tanpa I/O, tanpa dependensi
 * jaringan atau storage, tanpa import modul lain.
 *
 * Sumber frasa (pola dual-source gel26 gel27 rev 2, akses 15 Okt 2026):
 * KBBI III mirror kbbi.web.id plus Wiktionary ID via api.php revid.
 * Frasa putra mahkota, putri malu, putri boyongan nihil lema di KBBI
 * (mirror membalas landing page); putri malu terkunci Wiktionary ID
 * pageid 116302 revid 1268393 (Mimosa pudica, makna botani bukan relasi).
 *
 * Struktur blacklist: const array, satu entri satu baris, mudah ditambah.
 * Menambah entri TIDAK mengubah total map (guard tidak menambah lema);
 * total map 137 sejak gel35 (lema orang tua asuh), blacklist 10 frasa.
 */

/**
 * Blacklist frasa majemuk idiom dan turunan non-relasi.
 * Satu entri satu baris; tambah entri baru di baris terakhir.
 */
const POLISEMI_BLACKLIST: readonly string[] = [
  // putra mahkota: KBBI nihil lema (mirror akses 15 Okt 2026); makna budaya
  // istana, bukan istilah kekerabatan baku (putra sudah ada di map).
  'putra mahkota',
  // putri malu: KBBI nihil lema (mirror balas landing page); Wiktionary ID
  // pageid 116302 revid 1268393 = Mimosa pudica, makna botani.
  'putri malu',
  // putri boyongan: KBBI nihil lema (mirror balas landing page); idiom
  // kebiasaan pindah-pindah, bukan relasi kekerabatan.
  'putri boyongan',
  // berputra: turunan verba (meN- + putra), bukan lemma nomina relasi;
  // guard polisemi putra di kinship-aliases sudah menandai turunan ini.
  'berputra',
  // berputri: turunan verba (meN- + putri), pola berputra.
  'berputri',
  // cicit2: homograf KBBI III ci·cit2 onomatope tiruan bunyi tikus dan
  // anak burung; relasi pakai ci·cit1 (key cicit sudah ada di map).
  'cicit2',
  // canggah1: homograf KBBI III cang·gah1 galah atau dahan bercabang
  // (senjata tradisional); relasi pakai KBBI VI cang.gah2 (key canggah).
  'canggah1',
  // bebuyutan: idiom berlangsung lama turun-temurun, bukan relasi
  // per-orang; entri buyut di map tidak tersentuh.
  'bebuyutan',
  // berabang: turunan ber- dari abang (gel28), bukan lemma nomina relasi;
  // mirror KBBI III abang bagian turunan ber-a-bang v (mempunyai abang;
  // menyebut dengan sebutan abang), Wiktionary ID bagian Turunan berabang.
  'berabang',
  // mengasuh: turunan verba meN- dari asuh pola berputra berputri berabang, bukan lemma nomina relasi (gel35).
  'mengasuh',
]

/** Normalisasi frasa lokal, semantik sama dengan normalize kinship-aliases: trim, lowercase, buang titik tengah, rapat spasi. */
function normalizePhrase(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/\u00B7/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Guard polisemi: kembalikan frasa ternormalisasi bila lolos, atau null
 * bila frasa termasuk blacklist polisemi. Fungsi PURE.
 */
export function polisemiGuard(phrase: string): string | null {
  const key = normalizePhrase(phrase)
  if (POLISEMI_BLACKLIST.includes(key)) {
    return null
  }
  return key
}
