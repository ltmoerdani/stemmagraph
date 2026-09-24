// Modul pure pemetaan enum relasi non-inti GEDCOM 7 (v159 fase ii):
// STAT pada FAMC, PEDI pada INDIVIDUAL, dan VALUE pada ADOP.
// Level string saja: tanpa import react/zustand/prisma, tanpa I/O,
// tanpa side effect, deterministik. Enum GEDCOM 7 case-sensitive dan
// tidak dinormalisasi (sumber: spec GEDCOM 7.0.18 bagian 3.4,
// diverifikasi 25 Sep 2026).

/** Nilai enum STAT pada substruct FAMC. */
export type FamcStat = 'PROVEN' | 'CHALLENGED' | 'DISPROVEN';

/** Nilai enum PEDI pada path INDIVIDUAL.FAMC.PEDI. */
export type Pedi = 'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING' | 'OTHER';

/** Nilai enum VALUE pada ADOP (adopsi oleh suami, istri, atau keduanya). */
export type AdopValue = 'HUSB' | 'WIFE' | 'BOTH';

/** Hasil resolusi enum: nilai terparse, frasa mentah bila tak dikenal. */
export type EnumResolution<T extends string> = {
  value: T | null;
  phrase: string | null;
  raw: string;
  known: boolean;
};

/** Nilai valid STAT FAMC menurut spec GEDCOM 7.0.18 bagian 3.4. */
export const FAMC_STAT_VALUES = ['PROVEN', 'CHALLENGED', 'DISPROVEN'] as const;

/** Nilai valid PEDI menurut spec GEDCOM 7.0.18 bagian 3.4. */
export const PEDI_VALUES = [
  'ADOPTED',
  'BIRTH',
  'FOSTER',
  'SEALING',
  'OTHER',
] as const;

/** Nilai valid VALUE pada ADOP menurut spec GEDCOM 7.0.18 bagian 3.4. */
export const ADOP_VALUES = ['HUSB', 'WIFE', 'BOTH'] as const;

/**
 * Resolusi umum: cocokkan raw persis (case-sensitive, tanpa trim)
 * terhadap daftar nilai. Nilai dikenal: value terisi, phrase null.
 * Selain itu: value null dan phrase berisi raw utuh apa adanya.
 * Phrase berawalan underscore tidak diproses khusus di level ini;
 * bentuk aslinya tetap tersimpan di raw.
 */
function resolveEnumValue<T extends string>(
  values: readonly T[],
  raw: string,
): EnumResolution<T> {
  const known = (values as readonly string[]).includes(raw);
  if (known) {
    return { value: raw as T, phrase: null, raw, known: true };
  }
  return { value: null, phrase: raw, raw, known: false };
}

/** Resolusi nilai STAT pada FAMC. */
export function resolveFamcStat(raw: string): EnumResolution<FamcStat> {
  return resolveEnumValue(FAMC_STAT_VALUES, raw);
}

/** Resolusi nilai PEDI pada FAMC. */
export function resolvePedi(raw: string): EnumResolution<Pedi> {
  return resolveEnumValue(PEDI_VALUES, raw);
}

/** Resolusi nilai VALUE pada ADOP. */
export function resolveAdop(raw: string): EnumResolution<AdopValue> {
  return resolveEnumValue(ADOP_VALUES, raw);
}
