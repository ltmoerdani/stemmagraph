// Fixtures round-trip DATE GEDCOM 7 untuk v459 unit 4 (penutup sisa scope).
//
// 15 kasus: 11 string DATE verbatim dari fixture resmi maximal70.ged
// (gedcom.io/testfiles/gedcom70/maximal70.ged, diakses 19 Nov 2026) dan
// 4 kasus turunan grammar spec GEDCOM 7.0.18 (bab Date) karena fixture
// resmi tidak memuat kalender JULIAN/HEBREW/FRENCH_R standar maupun
// epoch BCE (temuan evidence Sena wake-329/330,
// notes/ev_2026-11-19_w329_matrix_authz_gedcom_fixtures.md).
//
// Setiap kasus menyimpan string DATE persis seperti tertulis di sumber
// (byte-per-byte). Test round-trip mem-parse lewat parseEventDateExt,
// memformat ulang lewat formatGedcomDateValueExt, lalu membandingkan
// hasil dengan string verbatim ini.
//
// Murni data: tanpa import kode apa pun, tanpa efek samping.

/** Satu kasus round-trip DATE. */
export interface DateRoundtripFixture {
  /** Slug kasus untuk pemilihan di test. */
  readonly id: string
  /** Label kelas kasus. */
  readonly kelas: string
  /** Asal string: fixture resmi atau turunan grammar spec. */
  readonly asal: 'maximal70' | 'turunan-grammar'
  /** Lokasi di maximal70 (nomor baris) atau dasar grammar untuk turunan. */
  readonly konteks: string
  /** String DATE verbatim asli, byte-per-byte, acuan assert round-trip. */
  readonly dateVerbatim: string
  /** Substructure TIME yang menemani di sumber (dokumentatif). */
  readonly time?: string
  /** Substructure PHRASE yang menemani di sumber (dokumentatif). */
  readonly phrase?: string
}

/** 11 kasus dari fixture resmi maximal70.ged. */
export const DATE_FIXTURES_MAXIMAL70: readonly DateRoundtripFixture[] = [
  {
    id: 'periode-from-to-phrase-event',
    kelas: 'periode FROM/TO dengan PHRASE (varian 1)',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 136 (juga 384): 2 DATE FROM 1700 TO 1800, 3 PHRASE No date phrase',
    dateVerbatim: 'FROM 1700 TO 1800',
    phrase: 'No date phrase',
  },
  {
    id: 'periode-from-to-phrase-sour-data',
    kelas: 'periode FROM/TO dengan PHRASE pada SOUR.DATA (varian 2)',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 691 (juga 718): 3 DATE FROM 1701 TO 1800, 4 PHRASE 18th century',
    dateVerbatim: 'FROM 1701 TO 1800',
    phrase: '18th century',
  },
  {
    id: 'periode-to-saja-phrase',
    kelas: 'periode TO saja dengan PHRASE',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 886: 1 DATE TO 1880, 2 PHRASE Dissolved in the 1870s',
    dateVerbatim: 'TO 1880',
    phrase: 'Dissolved in the 1870s',
  },
  {
    id: 'head-date-time',
    kelas: 'DATE+TIME pada HEAD',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 50: 1 DATE 10 JUN 2022, 2 TIME 15:43:20.48Z',
    dateVerbatim: '10 JUN 2022',
    time: '15:43:20.48Z',
  },
  {
    id: 'date-time-phrase',
    kelas: 'DATE+TIME+PHRASE lengkap',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 99: 2 DATE 27 MAR 2022, 3 TIME 16:02, 3 PHRASE Afternoon',
    dateVerbatim: '27 MAR 2022',
    time: '16:02',
    phrase: 'Afternoon',
  },
  {
    id: 'eksak-hari-bulan-tahun-polos',
    kelas: 'tanggal eksak hari-bulan-tahun tanpa substructure',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 312: 2 DATE 28 MAR 2022 (event deat type)',
    dateVerbatim: '28 MAR 2022',
  },
  {
    id: 'eksak-buri-type',
    kelas: 'tanggal eksak pada event TYPE buri',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 301: 2 DATE 30 MAR 2022 (event buri type)',
    dateVerbatim: '30 MAR 2022',
  },
  {
    id: 'eksak-hari-satu-digit-jan',
    kelas: 'tanggal eksak hari satu digit (birth type)',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 375: 2 DATE 1 JAN 2000 (event birth type)',
    dateVerbatim: '1 JAN 2000',
  },
  {
    id: 'eksak-hari-satu-digit-chr',
    kelas: 'tanggal eksak hari satu digit dengan AGE (chr type)',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 378: 2 DATE 9 JAN 2000, 2 AGE 8d (event chr type)',
    dateVerbatim: '9 JAN 2000',
  },
  {
    id: 'eksak-27-mar-berulang',
    kelas: 'tanggal eksak bentuk paling umum di maximal70',
    asal: 'maximal70',
    konteks: 'maximal70.ged: 2 DATE 27 MAR 2022 berulang di puluhan struktur (mis. baris 169, 181, 495)',
    dateVerbatim: '27 MAR 2022',
  },
  {
    id: 'tahun-saja-marr',
    kelas: 'tahun saja (presisi tahun)',
    asal: 'maximal70',
    konteks: 'maximal70.ged baris 224: 2 DATE 1998 pada 1 MARR',
    dateVerbatim: '1998',
  },
]

/**
 * 4 kasus turunan grammar spec GEDCOM 7.0.18 (bab Date).
 *
 * BUKAN bagian fixture resmi maximal70: fixture resmi tidak memuat
 * kalender JULIAN/HEBREW/FRENCH_R bentuk standar maupun epoch BCE
 * (verifikasi Sena wake-329/330). Bentuk di bawah disusun langsung dari
 * grammar type-Date spec 7.0.18:
 *   date = [calendar D] [[day D] month D] year [D epoch]
 *   calendar = GREGORIAN / JULIAN / FRENCH_R / HEBREW / extTag
 *   epoch = BCE / extTag
 * dan ditandai asal 'turunan-grammar'.
 */
export const DATE_FIXTURES_TURUNAN_GRAMMAR: readonly DateRoundtripFixture[] = [
  {
    id: 'kalender-julian',
    kelas: 'kalender JULIAN bentuk escape @#DJULIAN@',
    asal: 'turunan-grammar',
    konteks: 'grammar 7.0.18 bab Date: calendar = JULIAN (bentuk escape @#DJULIAN@)',
    dateVerbatim: '@#DJULIAN@ 12 JAN 1900',
  },
  {
    id: 'kalender-hebrew',
    kelas: 'kalender HEBREW dengan bulan non-Gregorian (TSH)',
    asal: 'turunan-grammar',
    konteks: 'grammar 7.0.18 bab Date: calendar = HEBREW; bulan TSH (Tishri) khas kalender Hebrew, tidak dipetakan di fase ini',
    dateVerbatim: '@#DHEBREW@ 5 TSH 5760',
  },
  {
    id: 'kalender-french-r',
    kelas: 'kalender FRENCH_R dengan bulan non-Gregorian (VEND)',
    asal: 'turunan-grammar',
    konteks: 'grammar 7.0.18 bab Date: calendar = FRENCH_R; bulan VEND (Vendemiaire) khas kalender Revolusi Prancis, tidak dipetakan di fase ini',
    dateVerbatim: '@#DFRENCH_R@ 12 VEND 10',
  },
  {
    id: 'epoch-bce-polos',
    kelas: 'epoch BCE tanpa prefix kalender',
    asal: 'turunan-grammar',
    konteks: 'grammar 7.0.18 bab Date: epoch = BCE pada akhir badan tanggal tanpa prefix kalender',
    dateVerbatim: '12 JAN 100 BCE',
  },
]

/** Seluruh 15 kasus round-trip DATE (11 maximal70 + 4 turunan). */
export const DATE_ROUNDTRIP_FIXTURES: readonly DateRoundtripFixture[] = [
  ...DATE_FIXTURES_MAXIMAL70,
  ...DATE_FIXTURES_TURUNAN_GRAMMAR,
]

/** Jumlah kasus, untuk assert kelengkapan fixtures. */
export const JUMLAH_KASUS_DATE_ROUNDTRIP = DATE_ROUNDTRIP_FIXTURES.length
