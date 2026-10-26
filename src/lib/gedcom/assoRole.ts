// Modul pure ASSO/ROLE GEDCOM 7 (v405 fase 1): enum role asosiasi dan
// bentuk data asosiasi antar individu hasil capture import.
//
// Spec GEDCOM 7.0.18 (halaman term resmi gedcom.io, diverifikasi 26 Okt
// 2026, evidence notes/956):
//   - ASSO {0:M} di bawah record INDI, payload pointer ke record-INDI
//     atau voidPtr @VOID@ dengan syarat PHRASE menjelaskan.
//   - ROLE {1:1} WAJIB di bawah ASSO: asosiasi tanpa ROLE adalah berkas
//     tidak valid. Enum 15 nilai: CHIL, CLERGY, FATH, FRIEND, GODP, HUSB,
//     MOTH, MULTIPLE, NGHBR, OFFICIATOR, PARENT, SPOU, WIFE, WITN, OTHER.
//   - PHRASE {0:1} di bawah ROLE (OTHER sebaiknya punya PHRASE).
//
// Kontrak modul (gaya relationship-enum.ts): murni fungsi, tanpa fs/
// network/db, tanpa efek samping, tanpa dependency. Enum case-sensitive
// dan tidak dinormalisasi. Tidak pernah melempar error.

/** Nilai valid ROLE di bawah ASSO menurut spec GEDCOM 7.0.18 enumset-ROLE. */
export const ASSO_ROLE_VALUES = [
  'CHIL',
  'CLERGY',
  'FATH',
  'FRIEND',
  'GODP',
  'HUSB',
  'MOTH',
  'MULTIPLE',
  'NGHBR',
  'OFFICIATOR',
  'PARENT',
  'SPOU',
  'WIFE',
  'WITN',
  'OTHER',
] as const

export type AssoRole = (typeof ASSO_ROLE_VALUES)[number]

/** Hasil resolusi enum ROLE, pola EnumResolution di relationship-enum.ts. */
export type AssoRoleResolution = {
  value: AssoRole | null
  phrase: string | null
  raw: string
  known: boolean
}

/**
 * Resolusi enum ROLE case-sensitive tanpa normalisasi: nilai dikenal
 * menghasilkan value terisi, selain itu value null dengan raw utuh.
 */
export function resolveAssoRole(raw: string): AssoRoleResolution {
  const known = (ASSO_ROLE_VALUES as readonly string[]).includes(raw)
  if (known) {
    return { value: raw as AssoRole, phrase: null, raw, known: true }
  }
  return { value: null, phrase: raw, raw, known: false }
}

/** Satu asosiasi ASSO level record INDI hasil capture import (verbatim). */
export interface ParsedAssociation {
  /** Pointer target tanpa tanda @, atau null bila @VOID@ (tanpa record target). */
  xref: string | null
  /** Payload ROLE verbatim apa adanya (mis. 'WITN', atau nilai non-enum). */
  role: string
  /** Hasil resolveAssoRole atas role: known bila termasuk 15 nilai enum. */
  roleResolved: AssoRoleResolution
  /** Payload PHRASE di bawah ROLE, atau undefined bila tidak ada. */
  phrase?: string
}
