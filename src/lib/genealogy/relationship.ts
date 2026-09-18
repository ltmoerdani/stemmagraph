/**
 * Tipe relasi anak ke orang tua, superset dari pedi GEDCOM.
 * BIRTH/ADOPTED/FOSTER berasal langsung dari PEDI;
 * OTHER menampung nilai lain (sealed, varian huruf besar kecil, dll).
 */
export type RelationshipType = 'BIRTH' | 'ADOPTED' | 'FOSTER' | 'OTHER'

/**
 * Pemetaan nilai PEDI GEDCOM ke RelationshipType.
 *
 * Aturan: BIRTH/ADOPTED/FOSTER dipetakan ke dirinya sendiri, NILAI LAIN
 * SEMUA (termasuk 'sealed' dan varian huruf besar kecil) dipetakan ke
 * OTHER. Properti raw menyimpan nilai asli apa adanya agar round-trip
 * tidak kehilangan data; konversi case adalah urusan pembaca, bukan
 * pemetaan.
 *
 * @param pedi nilai PEDI mentah dari sumber (GEDCOM/CSV)
 */
export function mapPediToRelationship(pedi: string): {
  type: RelationshipType
  raw: string
} {
  if (
    pedi === 'BIRTH' ||
    pedi === 'ADOPTED' ||
    pedi === 'FOSTER'
  ) {
    return { type: pedi, raw: pedi }
  }
  return { type: 'OTHER', raw: pedi }
}

/**
 * Relasi pasangan sederhana antara dua person.
 *
 * Struktur ini sengaja TIDAK mencegah satu person muncul di banyak
 * relasi (tanpa asumsi monogami): tidak ada uniqueness check di level
 * struktur, satu person boleh menjadi partners pada relasi berbeda.
 * personA dan personB adalah identifier string (mis. id internal).
 */
export interface PartnerRelation {
  partners: [string, string]
  type: 'PARTNER'
}

export function makePartnerRelation(
  personA: string,
  personB: string,
): PartnerRelation {
  return { partners: [personA, personB], type: 'PARTNER' }
}
