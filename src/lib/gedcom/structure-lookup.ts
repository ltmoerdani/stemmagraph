/**
 * Lookup tabel validasi struktur GEDCOM 7 (STG v120-i fase i-b).
 *
 * Sumber data: hasil generator scripts/generate-gedcom-schema-tables.mjs
 * (src/lib/gedcom/schema/gedcom7-structures.json, dibaca sekali via import statis).
 *
 * Modul PURE: tanpa import server/, tanpa akses filesystem runtime selain
 * pembacaan JSON tersebut. Kunci root dokumen menggunakan string kosong ('').
 */
import tableJson from './schema/gedcom7-structures.json';

export interface StructureEntry {
  uri: string;
  cardinality: string;
  payload: string | null;
}

interface StructureTable {
  meta: { counts: Record<string, number> };
  payloads: Record<string, string | null>;
  substructures: Record<string, Record<string, StructureEntry>>;
}

const table = tableJson as unknown as StructureTable;

const substructures: Readonly<Record<string, Record<string, StructureEntry>>> =
  table.substructures;
const payloads: Readonly<Record<string, string | null>> = table.payloads;

/**
 * Cari entri substructure <tag> di bawah superstructure <superUri>.
 * Untuk root dokumen, pakai superUri = '' (string kosong).
 * Mengembalikan undefined bila kombinasi tidak dikenal.
 */
export function lookupStructure(
  superUri: string,
  tag: string,
): StructureEntry | undefined {
  return substructures[superUri]?.[tag];
}

/**
 * Tipe payload untuk URI struktur (mis. 'https://gedcom.io/terms/v7/DATE'
 * mengembalikan URI type-Date). Null bila struktur tanpa payload atau
 * URI tidak ada di tabel.
 */
export function payloadType(structureUri: string): string | null {
  return payloads[structureUri] ?? null;
}

function isKnownTag(tag: string): boolean {
  for (const entries of Object.values(substructures)) {
    if (tag in entries) return true;
  }
  return false;
}

/**
 * Penanda extension GEDCOM: tag berawalan underscore, atau kombinasi
 * tag/URI yang tidak dikenal di tabel. Extension TIDAK ditolak, hanya
 * dicatat sebagai extension oleh pemanggil.
 */
export function isExtension(tagOrUri: string): boolean {
  if (tagOrUri.startsWith('_')) return true;
  if (tagOrUri.includes('://')) {
    return !(tagOrUri in payloads) && !(tagOrUri in substructures);
  }
  return !isKnownTag(tagOrUri);
}
