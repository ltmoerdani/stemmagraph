import { describe, expect, it } from 'vitest';
import { importIndividuals } from '../../../lib/gedcom/importIndividuals';
import { importFamilies } from '../../../lib/gedcom/importFamilies';

import { extractGedcom } from '../../../lib/gedcom/importPipeline';

const FIXTURE_1 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I1@ INDI',
  '1 NAME Budi /Santoso/',
  '1 SEX M',
  '0 @I2@ INDI',
  '1 NAME Siti /Aminah/',
  '1 SEX F',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '0 TRLR',
].join('\n');

const FIXTURE_2 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I10@ INDI',
  '1 NAME Joko /Widodo/',
  '1 SEX M',
  '0 @I11@ INDI',
  '1 NAME Iriana /Hartono/',
  '1 SEX F',
  '0 @I12@ INDI',
  '1 NAME Gibran /Rakabuming/',
  '1 SEX M',
  '0 @F5@ FAM',
  '1 HUSB @I10@',
  '1 WIFE @I11@',
  '1 CHIL @I12@',
  '0 TRLR',
].join('\n');

const FIXTURE_3 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I20@ INDI',
  '1 NAME Andi /Hasan/',
  '1 SEX M',
  '0 TRLR',
].join('\n');

const FIXTURE_4 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I30@ INDI',
  '1 NAME Dewi /Lestari/',
  '1 SEX F',
  '0 @I31@ INDI',
  '1 NAME Reza /Artamevia/',
  '1 SEX F',
  '0 @F10@ FAM',
  '1 HUSB @I30@',
  '1 WIFE @I31@',
  '0 TRLR',
].join('\n');

describe('GEDCOM Importer Round-Trip Fixtures (AC7)', () => {
  it('Fixture 1 (Minimal Couple)', () => {
    const bytes = new TextEncoder().encode(FIXTURE_1);
    const extracted = extractGedcom(bytes);
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis).toHaveLength(2);
    expect(fams).toHaveLength(1);
  });

  it('Fixture 2 (Family with Child)', () => {
    const bytes = new TextEncoder().encode(FIXTURE_2);
    const extracted = extractGedcom(bytes);
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis).toHaveLength(3);
    expect(fams).toHaveLength(1);
  });

  it('Fixture 3 (Single Individual)', () => {
    const bytes = new TextEncoder().encode(FIXTURE_3);
    const extracted = extractGedcom(bytes);
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis).toHaveLength(1);
    expect(fams).toHaveLength(0);
  });

  it('Fixture 4 (Same-sex / Diverse)', () => {
    const bytes = new TextEncoder().encode(FIXTURE_4);
    const extracted = extractGedcom(bytes);
    const indis = importIndividuals(extracted.text);
    const fams = importFamilies(extracted.text);
    expect(indis).toHaveLength(2);
    expect(fams).toHaveLength(1);
  });
});