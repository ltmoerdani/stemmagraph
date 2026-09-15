// Penerapan rencana import GEDCOM ke adapter tulis (S1F6-B).
//
// Fase kedua rantai import setelah buildImportPlan (S1F6-A). Rencana
// (member + relationship + skipped) diterapkan lewat io: sepasang callback
// tulis. Tugas modul ini mencatat hasil secara jujur; kebijakan (treeId,
// id asli, generation, maritalStatus) tetap milik wiring layer.
//
// Kontrak:
//   - Murni terhadap lingkungan: tanpa DB, tanpa env, tanpa jaringan,
//     tanpa state tersisa antar panggilan (pure core).
//   - Tidak pernah melempar. Setiap panggilan createMember/createRelation
//     dibungkus try/catch; error tercatat per entri (xref member atau
//     pasangan relasi) dan eksekusi lanjut ke entri berikutnya.
//   - Dua fase: semua member dulu (fase 1 membangun map xref -> id), lalu
//     semua relasi (fase 2). Relasi hanya dibuat bila KEDUA xref ada di
//     map hasil fase 1; selain itu di-skip dengan alasan 'unknown-xref'
//     tanpa lempar. Self loop (memberXref === relatedXref) di-skip
//     dengan alasan 'self-loop'.
//   - PlannedMember tanpa xref tetap dibuat; id tercatat di createdMembers
//     tanpa kunci map, dengan warning 'no-xref' di memberWarnings.
//   - Xref duplikat: member dibuat sekali (occurrence pertama), duplikat
//     selanjutnya warning 'duplicate-xref' dan memakai id yang sama.
//
// Catatan representasi tanggal: CreateMemberInput menetapkan
// birthDate/deathDate?: string sedangkan rencana membawa ParsedEventDate.
// Nilai diformat lewat formatGedcomDateValue dengan fallback
// originalDateString, sehingga presisi sumber tidak pernah diarang
// (ADR 0011): yang berubah hanya perwakilan, bukan makna.

import type { ImportPlan, PlannedMember, PlannedRelationship } from './importPlan'
import { formatGedcomDateValue } from './formatGedcomDate'
import type { ParsedEventDate } from './parseEventDate'

/** Masukan createMember sesuai kontrak io (S1F6-B). */
export interface CreateMemberInput {
  name: string | undefined
  gender: 'male' | 'female' | 'other'
  birthDate?: string
  deathDate?: string
  birthPlace?: string
}

/** Laporan jujur hasil penerapan plan; dilempar tidak pernah terjadi. */
export interface ImportApplyReport {
  createdMembers: { xref: string | undefined; id: string }[]
  duplicateXrefs: string[]
  failedMembers: { xref: string | undefined; error: string }[]
  createdRelations: number
  skippedRelations: { memberXref: string; relatedXref: string; reason: string }[]
  failedRelations: { memberXref: string; relatedXref: string; error: string }[]
  /** Peringatan per member ('duplicate-xref', 'no-xref'); bukan kegagalan. */
  memberWarnings: { xref: string | undefined; warning: string }[]
}

/** io yang dibutuhkan applyImportPlan; wiring layer menyuntikkan adapter nyata. */
export interface ImportApplyIO {
  treeId: string
  createMember: (input: CreateMemberInput) => Promise<string>
  createRelation: (
    treeId: string,
    memberId: string,
    relatedId: string,
    type: 'spouse' | 'parent',
  ) => Promise<string | void>
}

/** Format ParsedEventDate ke string; fallback teks asli bila formatter null. */
function dateString(parsed: ParsedEventDate | undefined): string | undefined {
  if (parsed === undefined) return undefined
  const formatted = formatGedcomDateValue(parsed)
  return formatted !== null ? formatted : parsed.originalDateString
}

/** Bentuk masukan createMember dari satu PlannedMember; lossless. */
function memberInput(member: PlannedMember): CreateMemberInput {
  return {
    name: member.name,
    gender: member.gender,
    birthDate: dateString(member.birthDate),
    deathDate: dateString(member.deathDate),
    birthPlace: member.birthPlace,
  }
}

/** Teks error apapun bentuknya (Error, non-Error) tanpa kehilangan info. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Menerapkan plan lewat io. Tidak pernah melempar: error adapter
 * terkumpul di report dan eksekusi berlanjut. Urutan panggilan adapter
 * dijamin: semua members dulu, lalu semua relations.
 */
export async function applyImportPlan(
  plan: ImportPlan,
  io: ImportApplyIO,
): Promise<ImportApplyReport> {
  const safeMembers: readonly PlannedMember[] = Array.isArray(plan?.members)
    ? plan.members
    : []
  const safeRelations: readonly PlannedRelationship[] = Array.isArray(
    plan?.relationships,
  )
    ? plan.relationships
    : []

  const createdMembers: ImportApplyReport['createdMembers'] = []
  const duplicateXrefs: string[] = []
  const failedMembers: ImportApplyReport['failedMembers'] = []
  const memberWarnings: ImportApplyReport['memberWarnings'] = []
  const ids = new Map<string, string>()

  // Fase 1: semua member. Xref duplikat dibuat sekali; duplikatnya warning
  // dan tercatat di createdMembers memakai id kemunculan pertama.
  for (const member of safeMembers) {
    const existingId = member.xref !== undefined ? ids.get(member.xref) : undefined
    if (existingId !== undefined) {
      duplicateXrefs.push(member.xref)
      memberWarnings.push({ xref: member.xref, warning: 'duplicate-xref' })
      createdMembers.push({ xref: member.xref, id: existingId })
      continue
    }

    let id: string
    try {
      id = await io.createMember(memberInput(member))
    } catch (error) {
      failedMembers.push({ xref: member.xref, error: errorText(error) })
      continue
    }

    createdMembers.push({ xref: member.xref, id })
    if (member.xref !== undefined) {
      ids.set(member.xref, id)
    } else {
      memberWarnings.push({ xref: undefined, warning: 'no-xref' })
    }
  }

  // Fase 2: relasi. Hanya bila kedua xref berhasil dibuat di fase 1.
  let createdRelations = 0
  const skippedRelations: ImportApplyReport['skippedRelations'] = []
  const failedRelations: ImportApplyReport['failedRelations'] = []

  for (const relation of safeRelations) {
    if (relation.memberXref === relation.relatedXref) {
      skippedRelations.push({
        memberXref: relation.memberXref,
        relatedXref: relation.relatedXref,
        reason: 'self-loop',
      })
      continue
    }

    const memberId = ids.get(relation.memberXref)
    const relatedId = ids.get(relation.relatedXref)
    if (memberId === undefined || relatedId === undefined) {
      skippedRelations.push({
        memberXref: relation.memberXref,
        relatedXref: relation.relatedXref,
        reason: 'unknown-xref',
      })
      continue
    }

    try {
      await io.createRelation(io.treeId, memberId, relatedId, relation.type)
      createdRelations += 1
    } catch (error) {
      failedRelations.push({
        memberXref: relation.memberXref,
        relatedXref: relation.relatedXref,
        error: errorText(error),
      })
    }
  }

  return {
    createdMembers,
    duplicateXrefs,
    failedMembers,
    createdRelations,
    skippedRelations,
    failedRelations,
    memberWarnings,
  }
}
