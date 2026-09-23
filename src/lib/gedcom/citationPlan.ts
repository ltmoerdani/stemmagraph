// Builder rencana sitasi (v155-i): menterjemahkan record mentah GEDCOM 7
// (GEDCStruct dari parser vendor) menjadi daftar entry rencana sitasi
// event-level, siap dipakai pembuat plan import tanpa menyentuh summary
// ImportedIndividual/ImportedFamily.
//
// Latar desain: summary ImportedIndividual menggabungkan citations BIRT dan
// DEAT menjadi satu array tanpa penanda event (importIndividuals.ts baris
// 130: [...citationsOf(birt), ...citationsOf(deat)]), sehingga konsumsi
// summary itu akan mencampur sitasi kelahiran dan kematian. Builder ini
// bekerja langsung di level record GEDCStruct dan membaca event BIRT/DEAT/
// MARR/DIV secara terpisah, jadi tiap sitasi pasti terikat ke event benar.
//
// Kontrak modul pure: tanpa prisma, tanpa IO, tanpa env, never throws.
// Payload sourcePointer/page/quay/note diteruskan verbatim, disiplin yang
// sama dengan citation.ts.

import { GEDCStruct } from './vendor/gedcstruct.js'
import { citationsOf } from './citation'

/** Satu entry rencana sitasi, terikat event secara eksplisit. */
export interface CitationPlanEntry {
  /** xref record INDI pemilik event, undefined bila entry dari FAM. */
  memberId: string | undefined
  /** xref record FAM pemilik event, undefined bila entry dari INDI. */
  relationId: string | undefined
  /** Jenis event pemilik sitasi. */
  eventKind: 'BIRT' | 'DEAT' | 'MARR' | 'DIV'
  /** Pointer SOUR verbatim, misal '@S1@'; non-pointer diteruskan apa adanya. */
  sourcePointer: string
  /** Sub-struktur PAGE verbatim, undefined bila tidak ada. */
  page?: string
  /** Sub-struktur QUAY verbatim, undefined bila tidak ada. */
  quay?: string
  /** Payload NOTE di bawah SOUR verbatim, undefined bila tidak ada. */
  note?: string
}

/** Sitasi event BIRT/DEAT dari satu record INDI, dengan memberId-nya. */
function entriesFromIndi(
  record: GEDCStruct,
  memberId: string | undefined,
): CitationPlanEntry[] {
  const out: CitationPlanEntry[] = []
  for (const eventKind of ['BIRT', 'DEAT'] as const) {
    const event = record.sub.find((s) => s.tag === eventKind)
    for (const c of citationsOf(event)) {
      out.push({
        memberId,
        relationId: undefined,
        eventKind,
        sourcePointer: c.sourcePointer,
        page: c.page,
        quay: c.quay,
        note: c.note,
      })
    }
  }
  return out
}

/** Sitasi event MARR/DIV dari satu record FAM, dengan relationId-nya. */
function entriesFromFam(
  record: GEDCStruct,
  relationId: string | undefined,
): CitationPlanEntry[] {
  const out: CitationPlanEntry[] = []
  for (const eventKind of ['MARR', 'DIV'] as const) {
    const event = record.sub.find((s) => s.tag === eventKind)
    for (const c of citationsOf(event)) {
      out.push({
        memberId: undefined,
        relationId,
        eventKind,
        sourcePointer: c.sourcePointer,
        page: c.page,
        quay: c.quay,
        note: c.note,
      })
    }
  }
  return out
}

/**
 * Bangun rencana sitasi dari record mentah hasil parse vendor: tiap event
 * BIRT/DEAT di record INDI dan MARR/DIV di record FAM menghasilkan entry
 * per sitasi SOUR, urutan file dipertahankan. Event tanpa SOUR terlewat
 * otomatis karena citationsOf return kosong. Pure, never throws.
 */
export function buildCitationPlanFromRecords(
  indiRecords: GEDCStruct[],
  famRecords: GEDCStruct[],
): CitationPlanEntry[] {
  const out: CitationPlanEntry[] = []
  try {
    for (const record of indiRecords) {
      if (record?.tag !== 'INDI') continue
      out.push(...entriesFromIndi(record, record.xref_id))
    }
    for (const record of famRecords) {
      if (record?.tag !== 'FAM') continue
      out.push(...entriesFromFam(record, record.xref_id))
    }
  } catch {
    return out
  }
  return out
}
