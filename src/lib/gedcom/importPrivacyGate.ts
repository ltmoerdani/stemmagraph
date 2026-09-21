/**
 * Import privacy gate (pure module).
 *
 * Menilai apakah seorang individu dari berkas GEDCOM impor sebaiknya
 * diperlakukan sebagai living. Modul ini PURE: tidak menyentuh
 * applyImportPlan, importPipeline, schema, server, UI, store, maupun lockfile.
 *
 * Aturan (safe default, konsisten dengan isLiving di exportPrivacyGate):
 * - Ada deathDate: bukan living.
 * - Tanpa deathDate: living (true), apa pun kondisi birthDate.
 *   Tidak ada penalaran usia; birthDate hanya turut diteruskan bila perlu.
 * - RESN CONFIDENTIAL/PRIVACY/LOCKED tidak difilter dan tidak diubah di sini;
 *   penilaian living tetap berjalan normal dan resn diteruskan utuh
 *   oleh pemanggil (applyResnToPrivacyStatus di resn-import.ts).
 */

export interface ImportPrivacyInput {
  id: string;
  deathDate?: unknown;
  birthDate?: unknown;
  resn?: unknown;
}

export interface ImportPrivacyAssessment {
  id: string;
  livingSuggested: boolean;
}

export interface AssessImportPrivacyOptions {
  /** Paksa hasil living; menang atas penilaian dari deathDate. */
  livingOverride?: boolean;
}

/** Nilai dianggap ada bila bukan undefined/null/string kosong. */
function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function assessImportPrivacy(
  individual: ImportPrivacyInput,
  options: AssessImportPrivacyOptions = {},
): ImportPrivacyAssessment {
  const override = options.livingOverride;
  if (typeof override === 'boolean') {
    return { id: individual.id, livingSuggested: override };
  }
  const hasDeathDate = hasValue(individual.deathDate);
  return { id: individual.id, livingSuggested: !hasDeathDate };
}
