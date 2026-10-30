// Test round-trip semantik fixture Gramps (GOAL v115 AC1).
//
// Alur: impor fixture via pipeline existing (extractGedcom, importIndividuals,
// importFamilies), lalu diverifikasi secara semantik di level model. Ekspor
// penuh (exportGedcom70 mode full) dan impor ulang menyusul di bagian bawah
// berkas ini seiring implementasi berjalan.
//
// Catatan jumlah record fixture gramps-exp-sample.ged (hasil grep level 0):
// 52 INDI, 16 FAM, 1 OBJE, 20 NOTE, 8 SOUR, 7 REPO, 1 SUBM. Angka di AC
// (3 OBJE 16 NOTE 4 SOUR) menghitung referensi OBJE level 1 dan berbeda dari
// jumlah record aktual; test ini memakai jumlah aktual fixture tervendorkan.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractGedcom } from './importPipeline';
import { importIndividuals } from './importIndividuals';
import { importFamilies } from './importFamilies';

const FIXTURE_DIR = join(__dirname, 'fixtures');
const EXP_SAMPLE = readFileSync(join(FIXTURE_DIR, 'gramps-exp-sample.ged'), 'utf8');
const IMP_CUSTOM = readFileSync(join(FIXTURE_DIR, 'gramps-imp-custom-tags.ged'), 'utf8');

// Daftar pengecualian sah (tidak dianggap kehilangan data material saat
// round-trip; didokumentasikan di docs/gedcom/roundtrip-compat.md, AC2).
const _PENGECUALIAN_SAHIH = [
  '_UID',
  'CHAN/CHANGE_DATE',
  'custom tag berawalan underscore',
  'REFN + TYPE',
  'RIN vs EXID',
  'header SUBM/DEST/COPR',
] as const;

describe('round-trip Gramps: impor tahap pertama', () => {
  it('gramps-exp-sample.ged menghasilkan 52 INDI dan 16 FAM', () => {
    const extracted = extractGedcom(new TextEncoder().encode(EXP_SAMPLE));
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis).toHaveLength(52);
    expect(fams).toHaveLength(16);
  });

  it('gramps-imp-custom-tags.ged menghasilkan INDI dan FAM', () => {
    const extracted = extractGedcom(new TextEncoder().encode(IMP_CUSTOM));
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis.length).toBeGreaterThan(0);
    expect(fams.length).toBeGreaterThan(0);
  });
});
