// GEDCOM 7.0 Round-Trip Fixtures for GOAL v119
//
// Evidence basis: 11 case classes from research (see roundTripGedcom70.fixtures.ts)
// plus additional fixtures for GEDZIP and third-party validation.
//
// Each fixture is a minimal GEDCOM 7.0 document designed for invariant round-trip
// verification. Payloads are byte-exact for comparison.

// Base header for GEDCOM 7.0 documents
const HEAD = '0 HEAD\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n'
// Trailer marker
const TRLR = '0 TRLR\n'

/** Round-trip fixture with invariant strings that must survive export-import cycle. */
export interface RoundTripFixture {
  /** Slug kelas kasus, used by tests to select fixture. */
  readonly id: string
  /** Case class label according to research evidence. */
  readonly kelas: string
  /** Full GEDCOM 7.0 document, terminated by newline. */
  readonly gedcom: string
  /** Substrings that must remain after round-trip verification. */
  readonly invariant: readonly string[]
}

/** All 11 required case classes per research evidence. */
export const ROUND_TRIP_FIXTURES: readonly RoundTripFixture[] = [
  {
    id: 'date-eksak',
    kelas: 'eksak DATE',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Eksak /Kasis/\n1 SEX M\n1 BIRT\n2 DATE 2 OCT 1889\n' +
      TRLR,
    invariant: ['2 DATE 2 OCT 1889'],
  },
  {
    id: 'date-from-to',
    kelas: 'rentang FROM-TO',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Rentang /Kasis/\n1 SEX F\n1 RESI\n2 DATE FROM 1900 TO 1910\n' +
      TRLR,
    invariant: ['2 DATE FROM 1900 TO 1910'],
  },
  {
    id: 'date-bet-and',
    kelas: 'BET-AND struktur penuh',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Bet /Kasis/\n1 SEX U\n1 BIRT\n2 DATE BET 1 JAN 1900 AND 31 DEC 1900\n' +
      TRLR,
    invariant: ['2 DATE BET 1 JAN 1900 AND 31 DEC 1900'],
  },
  {
    id: 'date-abt',
    kelas: 'ABT',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Abt /Kasis/\n1 SEX M\n1 BIRT\n2 DATE ABT 1885\n' +
      TRLR,
    invariant: ['2 DATE ABT 1885'],
  },
  {
    id: 'date-cal',
    kelas: 'CAL',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Cal /Kasis/\n1 SEX F\n1 BIRT\n2 DATE CAL 1885\n' +
      TRLR,
    invariant: ['2 DATE CAL 1885'],
  },
  {
    id: 'date-est',
    kelas: 'EST',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Est /Kasis/\n1 SEX X\n1 BIRT\n2 DATE EST 1885\n' +
      TRLR,
    invariant: ['2 DATE EST 1885'],
  },
  {
    id: 'date-phrase',
    kelas: 'phrase utuh',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Phrase /Kasis/\n1 SEX U\n1 BIRT\n2 DATE (menurut batu nisan, terbaca samar)\n' +
      TRLR,
    invariant: ['2 DATE (menurut batu nisan, terbaca samar)'],
  },
  {
    id: 'sex-mf-x-u',
    kelas: 'SEX M/F/X/U',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Alpha /Kasis/\n1 SEX M\n' +
      '0 @I2@ INDI\n1 NAME Beta /Kasis/\n1 SEX F\n' +
      '0 @I3@ INDI\n1 NAME Gamma /Kasis/\n1 SEX X\n' +
      '0 @I4@ INDI\n1 NAME Delta /Kasis/\n1 SEX U\n' +
      TRLR,
    invariant: ['1 SEX M', '1 SEX F', '1 SEX X', '1 SEX U'],
  },
  {
    id: 'void-cont-conc',
    kelas: '@VOID@ CONT/CONC',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME Void /Kasis/\n1 SEX U\n1 NOTE amanat @VOID@ dipertah\n2 CONT ANkan tanpa kehilangan tanda\n2 CONC baca dan barisnya\n' +
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
      '0 @I1@ INDI\n1 NAME Kakek /Kasis/\n1 SEX M\n1 FAMS @F2@\n' +
      '0 @I2@ INDI\n1 NAME Nenek /Kasis/\n1 SEX F\n1 FAMS @F2@\n' +
      '0 @I3@ INDI\n1 NAME Anak Pertama /Kasis/\n1 SEX M\n1 BIRT\n2 DATE 5 MAR 1920\n1 FAMC @F2@\n1 FAMS @F1@\n' +
      '0 @I4@ INDI\n1 NAME Anak Kedua /Kasis/\n1 SEX F\n1 BIRT\n2 DATE 9 JUN 1923\n1 FAMC @F2@\n1 FAMS @F1@\n' +
      '0 @I5@ INDI\n1 NAME Cucu /Kasis/\n1 SEX U\n1 BIRT\n2 DATE 1 FEB 1948\n1 FAMC @F1@\n' +
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
      '0 @I1@ INDI\n1 NAME Suami /Kasis/\n1 SEX M\n1 FAMS @F1@\n' +
      '0 @I2@ INDI\n1 NAME Isteri /Kasis/\n1 SEX F\n1 FAMS @F1@\n' +
      '0 @I3@ INDI\n1 NAME Anak /Kasis/\n1 SEX U\n1 FAMC @F1@\n' +
      '0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n' +
      TRLR,
    invariant: ['1 FAMS @F1@', '1 FAMC @F1@', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@'],
  },
]

/** Additional fixtures for GOAL v119: GEDZIP and extended validation */
export const GEDZIP_FIXTURES: readonly RoundTripFixture[] = [
  {
    id: 'gedzip-minimal',
    kelas: 'GEDZIP minimal',
    gedcom:
      HEAD +
      '0 @I1@ INDI\n1 NAME GEDZIP Test /Kasis/\n1 SEX M\n1 BIRT\n2 DATE 1 MAY 1900\n0 TRLR\n',
    invariant: ['2 DATE 1 MAY 1900', GEDZIP_ENTRY_NAME],
  },
  {
    id: 'full-suite',
    kelas: 'Full suite 11 + GEDZIP',
    gedcom:
      HEAD +
      // Combine multiple fixtures into one complete document
      '0 @I1@ INDI\n1 NAME Kompleks /Kasis/\n1 SEX M\n1 BIRT\n2 DATE 3 FEB 1920\n' +
      '1 FAMS @F1@\n' +
      '0 @I2@ INDI\n1 NAME Isteri /Kasis/\n1 SEX F\n1 BIRT\n2 DATE 2 JUN 1922\n1 FAMC @F1@\n' +
      '0 @F1@ FAM\n1 MARR\n2 DATE 15 AGO 1945\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n' +
      '0 @I3@ INDI\n1 NAME Anak /Kasis/\n1 SEX M\n1 BIRT\n2 DATE 28 DES 1948\n' +
      TRLR,
    invariant: [
      '2 DATE 3 FEB 1920',
      '2 DATE 2 JUN 1922',
      '2 DATE 15 AGO 1945',
      '2 DATE 28 DES 1948',
    ],
  },
]

// Export the entry name constant for GEDZIP guard testing
export const GEDZIP_ENTRY_NAME = 'gedcom.ged'

/** Total jumlah kelas kasus wajib 11 sesuai evidence riset tercatat. */
export const JUMLAH_KELAS_KASUS = 11

/** Total jumlah fixture termasuk GEDZIP. */
export const JUMLAH_TOTAL_FIXTURES = ROUND_TRIP_FIXTURES.length + GEDZIP_FIXTURES.length
