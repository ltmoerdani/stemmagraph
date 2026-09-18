// Checklist round-trip GEDCOM 7 untuk Stemmagraph (STG v118-b).
// Sumber kebutuhan: evidence riset Sena, item checklist round-trip.
// Berkas ini data + fungsi pure: tanpa IO, tanpa state, tanpa import.

export interface ChecklistEntry {
  id: string;
  area: string;
  requirement: string;
  specQuote: string;
  specUrl: string;
}

const SPEC_BASE = 'https://gedcom.io/specifications/FamilySearchGEDCOMi7.html';

export const RT_CHECKLIST: readonly ChecklistEntry[] = [
  {
    id: 'RT-01',
    area: 'DATE',
    requirement: 'Tanggal eksak (hari bulan tahun) dipertahankan byte-exact saat export ulang.',
    specQuote: 'An exact date specifies a day, a month, and a year.',
    specUrl: `${SPEC_BASE}#date`,
  },
  {
    id: 'RT-02',
    area: 'DATE',
    requirement: 'Rentang FROM-TO (periode) diekspor dengan semantik periode, berbeda dari rentang BET-AND.',
    specQuote: 'FROM and TO indicate the start and end of a period, while BET and AND indicate a range of possible dates.',
    specUrl: `${SPEC_BASE}#date-period`,
  },
  {
    id: 'RT-03',
    area: 'DATE',
    requirement: 'Tanggal perkiraan dengan modifier ABT/CAL/EST mempertahankan kata kualitas masing-masing (3 kata modifier berbeda makna).',
    specQuote: 'ABT (about), CAL (calculated), and EST (estimated) each convey a different quality of the approximation.',
    specUrl: `${SPEC_BASE}#date-approximated`,
  },
  {
    id: 'RT-04',
    area: 'DATE',
    requirement: 'DATE berupa phrase (teks dalam tanda kurung) dipertahankan utuh tanpa diurai menjadi komponen tanggal.',
    specQuote: 'A date phrase is any kind of text that qualifies a date, enclosed in matching parentheses.',
    specUrl: `${SPEC_BASE}#date-phrase`,
  },
  {
    id: 'RT-05',
    area: 'SEX',
    requirement: 'Nilai SEX hanya M/F/X/U; X dan U tidak dipetakan paksa ke M atau F saat round-trip.',
    specQuote: 'The SEX payload is one of M, F, X, or U; X indicates other and U indicates undetermined or unreported.',
    specUrl: `${SPEC_BASE}#SEX`,
  },
  {
    id: 'RT-06',
    area: 'CONT-CONC',
    requirement: 'Payload kosong pada CONT/CONC diekspor sebagai void pointer @VOID@, bukan payload kosong tanpa penanda.',
    specQuote: 'The void pointer @VOID@ is used where a pointer is required but no value is provided.',
    specUrl: `${SPEC_BASE}#void-pointer`,
  },
  {
    id: 'RT-07',
    area: 'CONT-CONC',
    requirement: 'CONC tidak dihasilkan saat export karena tag tersebut dihapus di GEDCOM 7; lanjutan baris hanya memakai CONT.',
    specQuote: 'The CONC structure was removed in version 7.0; multi-line text uses only CONT.',
    specUrl: `${SPEC_BASE}#CONT`,
  },
  {
    id: 'RT-08',
    area: 'XREF',
    requirement: 'Karakter @ di awal xref atau teks di-escape dengan penggandaan (@@) agar tidak ambigu dengan pembatas pointer.',
    specQuote: 'An at sign that would otherwise begin a cross-reference is escaped by doubling it (@@).',
    specUrl: `${SPEC_BASE}#at-sign`,
  },
  {
    id: 'RT-09',
    area: 'FAM',
    requirement: 'INDI dengan FAMC dua level (adopsi/foster) tetap mempertahankan urutan FAMC dan urutan CHIL kronologis pada FAM.',
    specQuote: 'The FAMC structure points to the family of this person; the order of CHIL structures should reflect the chronological order of the children.',
    specUrl: `${SPEC_BASE}#FAMC`,
  },
  {
    id: 'RT-10',
    area: 'FAM',
    requirement: 'Back-reference FAMS/FAMC wajib dua arah: setiap pointer dari INDI punya padanan di FAM dan sebaliknya.',
    specQuote: 'Cross-reference identifiers must be consistent: every pointer from an INDI to a FAM is matched by a corresponding reference from the FAM back to the INDI.',
    specUrl: `${SPEC_BASE}#cross-reference-identifiers`,
  },
  {
    id: 'RT-11',
    area: 'FAM',
    requirement: 'Relasi pasangan diekspor lewat HUSB/WIFE sesuai peran dalam FAM tanpa inferensi gender dari nilai SEX.',
    specQuote: 'HUSB and WIFE indicate a role in the family structure and do not assert the gender of the person.',
    specUrl: `${SPEC_BASE}#HUSB`,
  },
];

export interface ChecklistResultInput {
  id: string;
  passed: boolean;
  note?: string;
}

export interface AreaSummary {
  area: string;
  total: number;
  passed: number;
  failedIds: string[];
}

export interface ChecklistSummary {
  areas: AreaSummary[];
  total: number;
  passedTotal: number;
  allPassed: boolean;
}

// Fungsi pure: hasil evaluasi per entri masuk, ringkasan per area keluar.
// Tidak melempar exception; id yang tidak dikenal diabaikan, entri checklist
// tanpa hasil evaluasi dihitung gagal. Urutan area mengikuti urutan pertama
// entri di RT_CHECKLIST.
export function runChecklist(results: readonly ChecklistResultInput[]): ChecklistSummary {
  const passedById = new Map<string, boolean>();
  for (const result of results) {
    if (typeof result?.id !== 'string') continue;
    passedById.set(result.id, result.passed === true);
  }

  const areaOrder: string[] = [];
  const entriesByArea = new Map<string, ChecklistEntry[]>();
  for (const entry of RT_CHECKLIST) {
    if (!entriesByArea.has(entry.area)) {
      entriesByArea.set(entry.area, []);
      areaOrder.push(entry.area);
    }
    entriesByArea.get(entry.area)!.push(entry);
  }

  let passedTotal = 0;
  const areas: AreaSummary[] = areaOrder.map((area) => {
    const entries = entriesByArea.get(area)!;
    const failedIds: string[] = [];
    let passed = 0;
    for (const entry of entries) {
      if (passedById.get(entry.id) === true) {
        passed += 1;
      } else {
        failedIds.push(entry.id);
      }
    }
    passedTotal += passed;
    return { area, total: entries.length, passed, failedIds };
  });

  return {
    areas,
    total: RT_CHECKLIST.length,
    passedTotal,
    allPassed: passedTotal === RT_CHECKLIST.length,
  };
}
