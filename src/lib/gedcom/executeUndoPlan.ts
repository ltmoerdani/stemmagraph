// Stemmagraph v377: eksekutor rencana undo import (executeUndoPlan).
//
// Dasar: UndoPlan dari buildUndoPlan (v376) mendefinisikan apa yang
// harus dibalik: memberIdsToDelete (id internal buatan import) dan
// relationCountToReverse. Modul ini adalah wiring layer yang menjalankan
// pengembalian nyata lewat io yang disuntikkan (pola applyImportPlan:
// tanpa import server/, tanpa Date sistem, tidak pernah melempar).
//
// Kontrak:
//   - executeUndoPlan(plan, treeId, io): plan divalidasi level bentuk
//     (objek dengan memberIdsToDelete array); io menyediakan
//     listRelationships(treeId), deleteRelationship(id), deleteMember(id).
//   - Urutan: hapus dulu relasi yang menyentuh id di memberIdsToDelete
//     (memberId ATAU relatedId masuk set), lalu hapus member satu per
//     satu. Relasi yang tidak menyentuh member buatan import tidak disentuh.
//   - Id member di-dedupe urut kemunculan pertahanan ekstra meski plan
//     dari buildUndoPlan sudah distinct.
//   - Jujur per entri: gagal satu entri dicatat ke failedRelations atau
//     failedMembers lalu lanjut ke entri berikutnya; tidak pernah throw.
//   - Bentuk plan atau io buruk = report invalidInput true tanpa lempar.
//   - Kegagalan listRelationships juga tidak melempar: tercatat di
//     failedRelations dengan penanda fase, report invalidInput true.

/** Relasi seminimal mungkin yang dibutuhkan executor; bentuk adapter nyata. */
export interface UndoRelation {
  id: string
  memberId: string
  relatedId: string
}

/** io yang dibutuhkan executeUndoPlan; wiring layer menyuntikkan adapter. */
export interface UndoExecuteIO {
  listRelationships: (treeId: string) => Promise<unknown>
  deleteRelationship: (id: string) => Promise<void>
  deleteMember: (id: string) => Promise<void>
}

/** Laporan jujur hasil eksekusi undo; tidak pernah melempar. */
export interface UndoExecuteReport {
  /** True bila bentuk plan/io buruk atau daftar relasi tak terbaca. */
  invalidInput: boolean
  /** Id member yang berhasil dihapus, urut eksekusi. */
  deletedMemberIds: string[]
  /** Id relasi yang berhasil dihapus, urut eksekusi. */
  removedRelationIds: string[]
  /** Member gagal dihapus beserta pesan errornya. */
  failedMembers: { id: string; error: string }[]
  /** Relasi gagal dihapus beserta pesan errornya. */
  failedRelations: { id: string; error: string }[]
}

/** True bila v adalah objek biasa (bukan null/array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Pesan error jujur dari nilai lemparan apa pun, tanpa asumsi tipe. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Report kosong invalid-input; array segar agar bebas mutasi pemanggil. */
function invalidReport(): UndoExecuteReport {
  return {
    invalidInput: true,
    deletedMemberIds: [],
    removedRelationIds: [],
    failedMembers: [],
    failedRelations: [],
  }
}

/**
 * Mengeksekusi UndoPlan lewat io yang disuntikkan. Tidak pernah melempar:
 * bentuk buruk keluar report invalidInput, kegagalan io per entri tercatat
 * dan eksekusi lanjut (semangat jujur per entri applyImportPlan).
 */
export async function executeUndoPlan(
  plan: unknown,
  treeId: string,
  io: unknown,
): Promise<UndoExecuteReport> {
  // Validasi bentuk level: plan objek dengan memberIdsToDelete array,
  // treeId string, io lengkap tiga fungsi. Salah satu hilang atau tipe
  // salah = report invalidInput tanpa lempar.
  if (!isPlainObject(plan) || !Array.isArray(plan.memberIdsToDelete)) {
    return invalidReport()
  }
  if (typeof treeId !== 'string' || treeId.length === 0) return invalidReport()
  if (!isPlainObject(io)) return invalidReport()
  if (
    typeof io.listRelationships !== 'function' ||
    typeof io.deleteRelationship !== 'function' ||
    typeof io.deleteMember !== 'function'
  ) {
    return invalidReport()
  }

  // Dedupe id member urut kemunculan; entri non-string atau kosong
  // di-skip tanpa lempar (pertahanan ekstra di atas plan distinct v376).
  const deleteSet = new Set<string>()
  const memberIds: string[] = []
  for (const id of plan.memberIdsToDelete) {
    if (typeof id === 'string' && id.length > 0 && !deleteSet.has(id)) {
      deleteSet.add(id)
      memberIds.push(id)
    }
  }

  const report: UndoExecuteReport = {
    invalidInput: false,
    deletedMemberIds: [],
    removedRelationIds: [],
    failedMembers: [],
    failedRelations: [],
  }

  // Fase 0: baca daftar relasi pohon. Kegagalan di sini memblokir fase
  // relasi (id tak teridentifikasi) jadi seluruh undo dilaporkan tak sah
  // tanpa menyentuh member: lebih aman berhenti jujur daripada meninggalkan
  // relasi menggantung ke member yang sudah terhapus.
  let relations: unknown
  try {
    relations = await io.listRelationships(treeId)
  } catch (error) {
    return {
      invalidInput: true,
      deletedMemberIds: [],
      removedRelationIds: [],
      failedMembers: [],
      failedRelations: [
        { id: '', error: `listRelationships: ${errorMessage(error)}` },
      ],
    }
  }
  if (!Array.isArray(relations)) return invalidReport()

  // Fase 1: hapus dulu relasi yang menyentuh member buatan import
  // (memberId ATAU relatedId masuk set). Entri bentuk aneh di-skip.
  for (const rel of relations) {
    if (!isPlainObject(rel)) continue
    const id = rel.id
    const memberId = rel.memberId
    const relatedId = rel.relatedId
    if (
      typeof id !== 'string' ||
      typeof memberId !== 'string' ||
      typeof relatedId !== 'string'
    ) {
      continue
    }
    if (!deleteSet.has(memberId) && !deleteSet.has(relatedId)) continue
    try {
      await io.deleteRelationship(id)
      report.removedRelationIds.push(id)
    } catch (error) {
      report.failedRelations.push({ id, error: errorMessage(error) })
    }
  }

  // Fase 2: hapus member satu per satu, jujur per entri.
  for (const id of memberIds) {
    try {
      await io.deleteMember(id)
      report.deletedMemberIds.push(id)
    } catch (error) {
      report.failedMembers.push({ id, error: errorMessage(error) })
    }
  }

  return report
}
