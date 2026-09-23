// Penerapan rencana sitasi (v155-ii): rantai apply diperluas agar sitasi
// tersimpan, add-only terhadap applyImportPlan (S1F6-B).
//
// Fase ketiga rantai import setelah applyImportPlan. Masukan berupa
// CitationPlanEntry[] dari buildCitationPlanFromRecords (v155-i). Entry
// membawa xref sumber (memberId/relationId) yang harus dipetakan ke id DB
// lewat map hasil apply member (report.createdMembers). Xref yang tidak
// ditemukan di-skip dengan alasan jujur 'unknown-xref' tanpa lempar.
//
// Kontrak:
//   - Murni terhadap lingkungan: tanpa DB, tanpa env, tanpa jaringan.
//   - Tidak pernah melempar. Setiap panggilan upsertSource/upsertCitation
//     dibungkus try/catch; error tercatat per entry dan eksekusi lanjut.
//   - Idempoten per sourcePointer dalam satu run: upsertSource dipanggil
//     sekali untuk pointer pertama kali terlihat; entry berikutnya dengan
//     pointer sama memakai id cache tanpa memanggil adapter lagi.
//   - Mapping eventKind ke bentuk LifeEvent:
//       BIRT/DEAT : LifeEvent member tunggal (partnerMemberId absen)
//       MARR/DIV  : LifeEvent dengan partnerMemberId (pasangan FAM)
//   - TANPA io sitasi (undefined), return laporan kosong yang jujur:
//     nol source, nol citation, tanpa skip, tanpa error. Perilaku lama
//     rantai import tidak berubah.
//
// Pointer SOUR diteruskan verbatim (disiplin citationPlan.ts): title
// Source baru adalah pointer apa adanya, tanpa normalisasi.

import type { CitationPlanEntry } from './citationPlan'

/**
 * io sitasi opsional; wiring layer menyuntikkan adapter prisma nyata.
 * Callback upsert wajib idempoten di sisi DB (find-or-create); modul ini
 * menjamin satu panggilan per pointer dalam satu run.
 */
export interface CitationApplyIO {
  treeId: string
  /** Temukan atau buat Source untuk pointer verbatim; return id Source. */
  upsertSource: (treeId: string, pointer: string) => Promise<string>
  /**
   * Kaitkan sitasi ke LifeEvent; adapter menentukan bentuk upsert-nya
   * (buat Citation, set LifeEvent.citationId, dan sebagainya).
   * Return id Citation bila ada, boleh void.
   */
  upsertCitation: (
    treeId: string,
    spec: CitationLifeEventSpec,
  ) => Promise<string | void>
}

/** Referensi LifeEvent hasil resolusi entry sitasi, siap untuk adapter. */
export interface CitationLifeEventSpec {
  sourceId: string
  sourcePointer: string
  page: string | undefined
  quay: string | undefined
  note: string | undefined
  /** Jenis event pemilik sitasi (domain LifeEvent.eventType). */
  eventType: 'BIRTH' | 'DEATH' | 'MARRIAGE' | 'DIVORCE'
  /** id DB pemilik event (member tunggal, atau partner utama FAM). */
  memberId: string
  /** id DB pasangan, hanya untuk MARRIAGE/DIVORCE. */
  partnerMemberId: string | undefined
}

/** Laporan jujur fase sitasi; dilempar tidak pernah terjadi. */
export interface CitationApplyReport {
  createdSources: { pointer: string; id: string }[]
  createdCitations: {
    /** xref sumber entry (INDI atau FAM). */
    xref: string | undefined
    eventKind: CitationPlanEntry['eventKind']
    sourcePointer: string
    /** id Citation bila adapter mengembalikan string, '' bila void. */
    citationId: string
  }[]
  /** Sitasi terlewati dengan alasan ('unknown-xref', 'no-xref'). */
  skippedCitations: {
    xref: string | undefined
    eventKind: CitationPlanEntry['eventKind']
    sourcePointer: string
    reason: string
  }[]
  failedSources: { pointer: string; error: string }[]
  failedCitations: {
    sourcePointer: string
    eventType: CitationLifeEventSpec['eventType']
    memberId: string
    error: string
  }[]
}

/** Teks error apapun bentuknya (Error, non-Error) tanpa kehilangan info. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Pemetaan eventKind GEDCOM ke eventType domain LifeEvent. */
const EVENT_TYPE: Record<
  CitationPlanEntry['eventKind'],
  CitationLifeEventSpec['eventType']
> = {
  BIRT: 'BIRTH',
  DEAT: 'DEATH',
  MARR: 'MARRIAGE',
  DIV: 'DIVORCE',
}

/** BIRT/DEAT milik member tunggal; MARR/DIV memakai pasangan FAM. */
function isPartnerEvent(kind: CitationPlanEntry['eventKind']): boolean {
  return kind === 'MARR' || kind === 'DIV'
}

/**
 * Fase sitasi rantai import. Menerima plan entries, dua resolver xref
 * (dibangun wiring layer dari hasil apply member dan relasi), serta io
 * sitasi opsional. Tidak pernah melempar; error adapter terkumpul di
 * report. Per entry, upsertSource selalu mendahului upsertCitation.
 */
export async function applyCitationPlan(
  entries: readonly CitationPlanEntry[] | undefined,
  resolveMember: (xref: string) => string | undefined,
  resolveRelation: (xref: string) => [string, string] | undefined,
  io: CitationApplyIO | undefined,
): Promise<CitationApplyReport> {
  const safeEntries: readonly CitationPlanEntry[] = Array.isArray(entries)
    ? entries
    : []
  const report: CitationApplyReport = {
    createdSources: [],
    createdCitations: [],
    skippedCitations: [],
    failedSources: [],
    failedCitations: [],
  }
  if (io === undefined) return report
  if (safeEntries.length === 0) return report

  const sourceIds = new Map<string, string>()

  for (const entry of safeEntries) {
    const xref = entry.memberId ?? entry.relationId
    const kind = entry.eventKind
    const pointer = entry.sourcePointer

    // Tanpa xref sama sekali: tidak ada tempat sitasi menempel.
    if (xref === undefined) {
      report.skippedCitations.push({
        xref: undefined,
        eventKind: kind,
        sourcePointer: pointer,
        reason: 'no-xref',
      })
      continue
    }

    if (isPartnerEvent(kind)) {
      // MARR/DIV: relation xref menunjuk FAM; resolver mengembalikan
      // kedua id partner [utama, pasangan] bila FAM terresolusi penuh.
      const pair = resolveRelation(xref)
      if (pair === undefined) {
        report.skippedCitations.push({
          xref,
          eventKind: kind,
          sourcePointer: pointer,
          reason: 'unknown-xref',
        })
        continue
      }
      await applyOne(report, io, sourceIds, entry, xref, pair[0], pair[1])
    } else {
      const memberId = resolveMember(xref)
      if (memberId === undefined) {
        report.skippedCitations.push({
          xref,
          eventKind: kind,
          sourcePointer: pointer,
          reason: 'unknown-xref',
        })
        continue
      }
      await applyOne(report, io, sourceIds, entry, xref, memberId, undefined)
    }
  }

  return report
}

/** Terapkan satu entry yang xref-nya sudah terresolusi; never throws. */
async function applyOne(
  report: CitationApplyReport,
  io: CitationApplyIO,
  sourceIds: Map<string, string>,
  entry: CitationPlanEntry,
  xref: string,
  memberId: string,
  partnerMemberId: string | undefined,
): Promise<void> {
  const pointer = entry.sourcePointer

  // Source idempoten per pointer dalam satu run: satu panggilan adapter
  // untuk kemunculan pertama, sisanya memakai id cache. Kegagalan upsert
  // menghentikan entry ini (sitasi tak bisa dibuat tanpa source) namun
  // tidak menghentikan entry berikutnya.
  let sourceId = sourceIds.get(pointer)
  if (sourceId === undefined) {
    try {
      sourceId = await io.upsertSource(io.treeId, pointer)
    } catch (error) {
      report.failedSources.push({ pointer, error: errorText(error) })
      return
    }
    sourceIds.set(pointer, sourceId)
    report.createdSources.push({ pointer, id: sourceId })
  }

  try {
    const citationId = await io.upsertCitation(io.treeId, {
      sourceId,
      sourcePointer: pointer,
      page: entry.page,
      quay: entry.quay,
      note: entry.note,
      eventType: EVENT_TYPE[entry.eventKind],
      memberId,
      partnerMemberId,
    })
    report.createdCitations.push({
      xref,
      eventKind: entry.eventKind,
      sourcePointer: pointer,
      citationId: typeof citationId === 'string' ? citationId : '',
    })
  } catch (error) {
    report.failedCitations.push({
      sourcePointer: pointer,
      eventType: EVENT_TYPE[entry.eventKind],
      memberId,
      error: errorText(error),
    })
  }
}
