// Fixture suite round-trip GEDCOM 7.0 (v118-a, improve/stg-v118-a-rt-fixture).
//
// Sumber kebenaran: evidence riset tercatat untuk 11 kelas kasus GEDCOM 7:
// eksak DATE, rentang FROM-TO, BET-AND struktur penuh, ABT, CAL, EST,
// phrase utuh, SEX M/F/X/U, @VOID@ CONT/CONC, FAMC dua level plus urutan
// CHIL kronologis, dan FAMS/FAMC back-reference dua arah.
//
// Setiap fixture adalah dokumen GEDCOM 7.0 minimal yang sengaja kecil agar
// invariant round-trip bisa ditegakkan per kelas tanpa noise. Payload tetap
// byte-exact: pengujian membandingkan bentuk kanonik baris, bukan hasil
// re-render bebas.

export interface RoundTripFixture {
  /** Slug kelas kasus, dipakai test untuk memilih fixture. */
  readonly id: string
  /** Label kelas kasus sesuai daftar evidence riset. */
  readonly kelas: string
  /** Dokumen GEDCOM 7.0 lengkap, diakhiri baris baru. */
  readonly gedcom: string
  /** Substring yang wajib tetap ada setelah round-trip. */
  readonly invariant: readonly string[]
}

const HEAD = '0 HEAD\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n'
const TRLR = '0 TRLR\n'

export const ROUND_TRIP_FIXTURES: readonly RoundTripFixture[] = [
  {
    id: 'date-eksak',
    kelas: 'eksak DATE',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Eksak /Kasus/\n1 SEX M\n1 BIRT\n2 DATE 2 OCT 1889\n' +
      TRLR,
    invariant: ['2 DATE 2 OCT 1889'],
  },
  {
    id: 'date-from-to',
    kelas: 'rentang FROM-TO',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Rentang /Kasus/\n1 SEX F\n1 RESI\n2 DATE FROM 1900 TO 1910\n' +
      TRLR,
    invariant: ['2 DATE FROM 1900 TO 1910'],
  },
  {
    id: 'date-bet-and',
    kelas: 'BET-AND struktur penuh',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Bet /Kasus/\n1 SEX U\n1 BIRT\n2 DATE BET 1 JAN 1900 AND 31 DEC 1900\n' +
      TRLR,
    invariant: ['2 DATE BET 1 JAN 1900 AND 31 DEC 1900'],
  },
  {
    id: 'date-abt',
    kelas: 'ABT',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Abt /Kasus/\n1 SEX M\n1 BIRT\n2 DATE ABT 1885\n' +
      TRLR,
    invariant: ['2 DATE ABT 1885'],
  },
  {
    id: 'date-cal',
    kelas: 'CAL',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Cal /Kasus/\n1 SEX F\n1 BIRT\n2 DATE CAL 1885\n' +
      TRLR,
    invariant: ['2 DATE CAL 1885'],
  },
  {
    id: 'date-est',
    kelas: 'EST',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Est /Kasus/\n1 SEX X\n1 BIRT\n2 DATE EST 1885\n' +
      TRLR,
    invariant: ['2 DATE EST 1885'],
  },
  {
    id: 'date-phrase',
    kelas: 'phrase utuh',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Phrase /Kasus/\n1 SEX U\n1 BIRT\n2 DATE (menurut batu nisan, terbaca samar)\n' +
      TRLR,
    invariant: ['2 DATE (menurut batu nisan, terbaca samar)'],
  },
  {
    id: 'sex-mf-x-u',
    kelas: 'SEX M/F/X/U',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Alpha /Kasus/\n1 SEX M\n' +
      '0 @I2@ INDI\n1 NAME Beta /Kasus/\n1 SEX F\n' +
      '0 @I3@ INDI\n1 NAME Gamma /Kasus/\n1 SEX X\n' +
      '0 @I4@ INDI\n1 NAME Delta /Kasus/\n1 SEX U\n' +
      TRLR,
    invariant: ['1 SEX M', '1 SEX F', '1 SEX X', '1 SEX U'],
  },
  {
    id: 'void-cont-conc',
    kelas: '@VOID@ CONT/CONC',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Void /Kasus/\n1 SEX U\n1 NOTE amanat @VOID@ dipertah\n2 CONT ANkan tanpa kehilangan tanda\n2 CONC baca dan barisnya\n' +
      TRLR,
    invariant: [
      '1 NOTE amanat @VOID@ dipertah',
      '2 CONT ANkan tanpa kehilangan tanda',
      '2 CONC baca dan barisnya',
    ],
  },
  {
    id: 'famc-dua-level-chil-kronologis',
    kelas: 'FAMC dua level plus urutan CHIL kronologis',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Kakek /Kasus/\n1 SEX M\n1 FAMS @F2@\n' +
      '0 @I2@ INDI\n1 NAME Nenek /Kasus/\n1 SEX F\n1 FAMS @F2@\n' +
      '0 @I3@ INDI\n1 NAME Anak Pertama /Kasus/\n1 SEX M\n1 BIRT\n2 DATE 5 MAR 1920\n1 FAMC @F2@\n1 FAMS @F1@\n' +
      '0 @I4@ INDI\n1 NAME Anak Kedua /Kasus/\n1 SEX F\n1 BIRT\n2 DATE 9 JUN 1923\n1 FAMC @F2@\n1 FAMS @F1@\n' +
      '0 @I5@ INDI\n1 NAME Cucu /Kasus/\n1 SEX U\n1 BIRT\n2 DATE 1 FEB 1948\n1 FAMC @F1@\n' +
      '0 @F1@ FAM\n1 MARR\n2 DATE 10 MAY 1947\n1 HUSB @I3@\n1 WIFE @I4@\n1 CHIL @I5@\n' +
      '0 @F2@ FAM\n1 MARR\n2 DATE 1919\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n1 CHIL @I4@\n' +
      TRLR,
    invariant: ['1 CHIL @I3@\n1 CHIL @I4@'],
  },
  {
    id: 'fams-famc-dua-arah',
    kelas: 'FAMS/FAMC back-reference dua arah',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Suami /Kasus/\n1 SEX M\n1 FAMS @F1@\n' +
      '0 @I2@ INDI\n1 NAME Isteri /Kasus/\n1 SEX F\n1 FAMS @F1@\n' +
      '0 @I3@ INDI\n1 NAME Anak /Kasus/\n1 SEX U\n1 FAMC @F1@\n' +
      '0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n' +
      TRLR,
    invariant: ['1 FAMS @F1@', '1 FAMC @F1@', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@'],
  },
]

/** Jumlah kelas kasus wajib 11 sesuai evidence riset tercatat. */
export const JUMLAH_KELAS_KASUS = 11
