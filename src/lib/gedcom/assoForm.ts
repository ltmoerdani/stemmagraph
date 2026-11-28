// Modul pure validasi dan pembentukan form asosiasi ASSO (v468).
// Turunan langsung evidence spek GEDCOM 7.0.18 wake-355/wake-361
// (notes workspace Sena): ASSO payload pointer ke record-INDI,
// ROLE kardinalitas {1:1} wajib, voidPtr @VOID@ + PHRASE untuk orang
// yang tidak direferensikan record INDI manapun, dan larangan
// menampilkan xref ke pengguna (spek bagian 1.3).
//
// Contoh resmi spek yang ditiru mode orang di luar pohon:
//   1 ASSO @VOID@
//   2 PHRASE Mr Stockdale
//   2 ROLE OTHER
//   3 PHRASE Teacher
//
// Kontrak modul (gaya assoRole.ts): murni fungsi, tanpa fs/network/db,
// tanpa efek samping, tanpa dependency React. Tidak pernah melempar.

import type { ParsedAssociation, AssoRole } from './assoRole'
import { ASSO_ROLE_VALUES } from './assoRole'

/** Pilihan person di picker: hanya INDI existing di pohon aktif. */
export interface AssoPersonOption {
  id: string
  name: string
}

/** Keadaan form asosiasi sebelum divalidasi. */
export interface AssoFormInput {
  /** Person terpilih dari picker, null bila mode orang di luar pohon. */
  person: AssoPersonOption | null
  /** Mode orang di luar pohon: ASSO @VOID@ + PHRASE nama. */
  outsideTree: boolean
  /** Nama orang di luar pohon (wajib bila outsideTree). */
  outsideName: string
  /** ROLE terpilih, kosong bila belum dipilih. */
  role: AssoRole | ''
  /** PHRASE peran bebas, wajib bila role OTHER. */
  rolePhrase: string
}

/** Hasil validasi form: errors berisi pesan siap tampilkan di UI. */
export interface AssoFormValidation {
  ok: boolean
  errors: string[]
}

/**
 * Validasi form asosiasi (AC2): ROLE wajib terisi sesuai kardinalitas
 * {1:1}; tanpa ROLE form menolak simpan dengan pesan jelas. Mode orang
 * di luar pohon wajib punya nama (untuk PHRASE), role OTHER wajib
 * punya PHRASE peran.
 */
export function validateAssoForm(input: AssoFormInput): AssoFormValidation {
  const errors: string[] = []
  if (input.role === '') {
    errors.push('Role is required for an association (GEDCOM 7 ROLE {1:1}).')
  }
  if (input.role === 'OTHER' && input.rolePhrase.trim() === '') {
    errors.push('Role OTHER requires a phrase describing the role.')
  }
  if (input.outsideTree && input.outsideName.trim() === '') {
    errors.push('Name of the person outside the tree is required.')
  }
  if (!input.outsideTree && input.person === null) {
    errors.push('Select a person from the tree.')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Bentuk ParsedAssociation dari form yang sudah lulus validasi (AC1+AC3).
 * Person existing: xref id person (pointer INDI). Orang di luar pohon:
 * xref null (ditulis @VOID@) dengan phrase = nama, role OTHER ber-phrase
 * peran, meniru contoh resmi spek.
 */
export function buildAssociation(input: AssoFormInput): ParsedAssociation {
  const role: string = input.role === '' ? '' : input.role
  if (input.outsideTree) {
    return {
      xref: null,
      role: 'OTHER',
      roleResolved: { value: 'OTHER', phrase: null, raw: 'OTHER', known: true },
      phrase: input.outsideName.trim(),
    }
  }
  const xref = input.person === null ? null : input.person.id
  if (role === 'OTHER') {
    return {
      xref,
      role: 'OTHER',
      roleResolved: { value: 'OTHER', phrase: null, raw: 'OTHER', known: true },
      phrase: input.rolePhrase.trim() === '' ? undefined : input.rolePhrase.trim(),
    }
  }
  return {
    xref,
    role,
    roleResolved: { value: role as AssoRole, phrase: null, raw: role, known: true },
  }
}

/**
 * Label asosiasi untuk UI (AC4): xref TIDAK PERNAH ditampilkan, label
 * selalu nama. Person existing memakai nama dari peta person; @VOID@
 * memakai PHRASE nama yang tersimpan; tanpa keduanya memakai fallback.
 */
export function assoLabel(
  asso: ParsedAssociation,
  personNameById: (id: string) => string | undefined,
): string {
  if (asso.xref !== null && asso.xref !== undefined) {
    const name = personNameById(asso.xref)
    if (name !== undefined) return name
    return 'Unknown person'
  }
  if (asso.phrase !== undefined && asso.phrase !== '') return asso.phrase
  return 'Person outside the tree'
}

/** Daftar role untuk dropdown UI, urut dokumen enum spek. */
export const ASSO_ROLE_OPTIONS: readonly AssoRole[] = ASSO_ROLE_VALUES
