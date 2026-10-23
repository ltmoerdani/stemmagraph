// Stemmagraph v376: rencana pengembalian pasca import (import undo plan).
//
// Dasar: applyImportPlan (S1F6-B) dua fase menghasilkan ImportApplyReport
// jujur per entri; createdMembers membawa id internal nyata hasil io.
// Import yang salah berkas perlu dikembalikan ke kondisi sebelum import
// TANPA menyentuh data lama. Undo aman hanya membalik apa yang DIBUAT
// import terakhir: member yang id internalnya muncul di createdMembers
// dan tidak pernah ada di pohon sebelum import (existingIds), plus
// relasi yang tercatat sebagai berhasil dibuat.
//
// Aturan inti:
//   1. memberIdsToDelete: id createdMembers yang bukan anggota
//      existingIds, distinct, urutan kemunculan pertama dipertahankan.
//      Id yang sudah ada di existingIds adalah konflik existing-tree:
//      undo DILARANG menyentuhnya, dicatat ke conflicts.
//   2. relationCountToReverse: createdRelations apa adanya (angka
//      agregat; wiring layer yang membalik relasi nyata satu per satu).
//      Nilai bukan angka berhingga dianggap 0 tanpa lempar.
//   3. duplicateXrefs, failedMembers, skippedRelations, failedRelations,
//      memberWarnings tidak mengubah plan: bukan karya import yang
//      berhasil dibalik, hanya jejak kegagalan/peringatan.
//   4. Modul pure: tanpa DB, tanpa Date sistem, tanpa IO, tanpa import
//      server/, tidak pernah melempar. Bentuk buruk level payload
//      menghasilkan plan kosong invalid-input tanpa throw; entri jelek
//      di-skip per entri (semangat jujur per entri applyImportPlan).
//
// Non-goal: tanpa eksekusi penghapusan nyata (wiring layer menyuntikkan
// io, pola applyImportPlan); tanpa undo multi langkah (satu import
// terakhir saja); tanpa sentuh semantik v373/v375.

import type { ImportApplyReport } from './applyImportPlan'

/** Rencana pengembalian satu import terakhir, siap dieksekusi wiring layer. */
export interface UndoPlan {
  /** Id internal hasil import terakhir, distinct, urut kemunculan. */
  memberIdsToDelete: string[]
  /** Jumlah relasi yang dibuat import; dibalik wiring layer. */
  relationCountToReverse: number
  /** True hanya bila tidak ada id createdMembers di existingIds. */
  safe: boolean
  /** Id tabrakan dengan pohon existing; undo tidak boleh menyentuh. */
  conflicts: { id: string; detail: string }[]
}

/** Payload builder: report nyata applyImportPlan + id pohon pra-import. */
export interface UndoPlanPayload {
  report: ImportApplyReport
  existingIds: string[]
}

/** Plan kosong invalid-input; array segar agar bebas mutasi pemanggil. */
function emptyPlan(): UndoPlan {
  return {
    memberIdsToDelete: [],
    relationCountToReverse: 0,
    safe: false,
    conflicts: [{ id: '', detail: 'invalid-input' }],
  }
}

/** True bila v adalah objek biasa (bukan null/array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Membangun rencana undo dari report import terakhir. Tidak pernah
 * melempar: bentuk buruk keluar plan kosong invalid-input, entri jelek
 * di-skip per entri.
 */
export function buildUndoPlan(payload: unknown): UndoPlan {
  // Validasi bentuk payload level: report objek, existingIds array,
  // createdMembers array. Salah satu hilang atau tipe salah = plan kosong.
  if (!isPlainObject(payload)) return emptyPlan()
  const report = payload.report
  const existingIds = payload.existingIds
  if (!isPlainObject(report)) return emptyPlan()
  if (!Array.isArray(existingIds)) return emptyPlan()
  if (!Array.isArray(report.createdMembers)) return emptyPlan()

  // createdRelations agregat: angka berhingga dipakai apa adanya; selain
  // itu dianggap 0 tanpa lempar (bentuk buruk parsial satu field tidak
  // membatalkan plan yang lain).
  const relationCount =
    typeof report.createdRelations === 'number' && Number.isFinite(report.createdRelations)
      ? report.createdRelations
      : 0

  // Peta id existing untuk cek keanggotaan O(1); entri non-string di-skip.
  const existing = new Set<string>()
  for (const id of existingIds) {
    if (typeof id === 'string') existing.add(id)
  }

  const memberIdsToDelete: string[] = []
  const conflicts: UndoPlan['conflicts'] = []
  const seen = new Set<string>()

  // Satu pass: id valid distinct; anggota existing masuk conflicts,
  // id baru masuk delete list, keduanya urut kemunculan pertama.
  for (const entry of report.createdMembers) {
    if (!isPlainObject(entry)) continue
    const id = entry.id
    if (typeof id !== 'string') continue
    if (seen.has(id)) continue
    seen.add(id)
    if (existing.has(id)) {
      conflicts.push({ id, detail: 'conflict existing-tree: id sudah ada sebelum import' })
    } else {
      memberIdsToDelete.push(id)
    }
  }

  return {
    memberIdsToDelete,
    relationCountToReverse: relationCount,
    safe: conflicts.length === 0,
    conflicts,
  }
}
