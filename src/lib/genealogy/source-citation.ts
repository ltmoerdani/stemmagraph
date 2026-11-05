import type { FamilyMember } from '../../types/family'
import { isEventKind, type EventKind, type GenealogicalEvent } from './genealogical-event'

/**
 * Entitas sumber dan sitasi (v419 fase 2, AC2).
 *
 * Bentuk data mengikuti pola SOUR/QUAY GEDCOM 7: satu GenealogicalSource
 * adalah record SOUR (buku, arsip, akta), satu GenealogicalCitation adalah
 * penunjuk SOUR pada data lain dengan QUAY sebagai tingkat keyakinan.
 *
 * Koneksi ke anggota keluarga memakai field sourceIds yang sudah ada di
 * FamilyMember (src/types/family.ts), tanpa mengubah tipe tersebut.
 */

/** Kategori sumber, dipetakan dari jenis data yang disimpan. */
export const SOURCE_CATEGORIES = [
  'birth',
  'death',
  'marriage',
  'census',
  'personal',
  'other',
] as const

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number]

/**
 * Tingkat keyakinan QUAY GEDCOM 7: 0 tidak dapat diandalkan, 1 diragukan,
 * 2 bukti tidak langsung/sekunder, 3 bukti langsung/primer.
 */
export const QUAY_LEVELS = [0, 1, 2, 3] as const

export type QuayLevel = (typeof QUAY_LEVELS)[number]

/** Record sumber genealogis, setara satu record SOUR GEDCOM 7. */
export interface GenealogicalSource {
  /** Identitas unik sumber, wajib. */
  id: string
  /** Judul sumber verbatim (mis. nama akta atau judul buku). */
  title: string
  /** Kategori data utama yang disimpan sumber ini. */
  category: SourceCategory
  /** Penunjuk lokasi dokumen asli: URL arsip, nomor arsip, atau rak perpustakaan. */
  reference?: string
  /** Penerbit atau penyimpan dokumen (GEDCOM 7 SOUR.AUTH). */
  author?: string
  /** Catatan bebas tentang sumber. */
  note?: string
}

/** Masukan builder makeSource; category ikut default 'other' bila kosong. */
export interface MakeSourceInput {
  id: string
  title: string
  category?: SourceCategory
  reference?: string
  author?: string
  note?: string
}

export function isSourceCategory(value: unknown): value is SourceCategory {
  return (
    typeof value === 'string' &&
    (SOURCE_CATEGORIES as readonly string[]).includes(value)
  )
}

export function isQuayLevel(value: unknown): value is QuayLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (QUAY_LEVELS as readonly number[]).includes(value)
  )
}

/**
 * Builder GenealogicalSource dengan validasi fail-fast.
 *
 * @throws Error bila id atau title kosong/whitespace, atau category di
 * luar SOURCE_CATEGORIES.
 */
export function makeSource(input: MakeSourceInput): GenealogicalSource {
  const id = input.id?.trim() ?? ''
  if (id === '') {
    throw new Error('id sumber wajib diisi dan tidak boleh kosong.')
  }

  const title = input.title?.trim() ?? ''
  if (title === '') {
    throw new Error('title sumber wajib diisi (verbatim, tidak boleh kosong).')
  }

  const category = input.category ?? 'other'
  if (!isSourceCategory(category)) {
    throw new Error(
      'category sumber tidak dikenal: "' +
        String(input.category) +
        '". Gunakan salah satu dari: ' +
        SOURCE_CATEGORIES.join(', ') +
        '.',
    )
  }

  return {
    id,
    title,
    category,
    reference: input.reference,
    author: input.author,
    note: input.note,
  }
}

/** Sitasi satu sumber pada satu event anggota, setara blok SOUR + QUAY. */
export interface GenealogicalCitation {
  /** Identitas unik sitasi, wajib. */
  id: string
  /** GenealogicalSource.id yang dirujuk (pola SOUR GEDCOM 7). */
  sourceId: string
  /** FamilyMember.id pemilik data yang disitasi. */
  memberId: string
  /** GenealogicalEvent.id event yang disitasi. */
  eventId: string
  /** Jenis event GEDCOM yang disitasi: BIRT, DEAT, atau MARR. */
  eventKind: EventKind
  /** Tingkat keyakinan QUAY GEDCOM 7 (0-3). */
  quay: QuayLevel
  /** Penunjuk halaman/lembar dalam sumber (GEDCOM 7 SOUR.PAGE). */
  page?: string
  /** Catatan bebas tentang sitasi ini. */
  note?: string
}

/** Masukan builder makeCitation; quay ikut default 3 bila kosong. */
export interface MakeCitationInput {
  id: string
  sourceId: string
  memberId: string
  eventId: string
  eventKind: string
  quay?: QuayLevel
  page?: string
  note?: string
}

/**
 * Builder GenealogicalCitation dengan validasi fail-fast.
 *
 * @throws Error bila id, sourceId, memberId, atau eventId kosong,
 * eventKind di luar EVENT_KINDS, atau quay bukan bilangan bulat 0-3.
 */
export function makeCitation(input: MakeCitationInput): GenealogicalCitation {
  const id = input.id?.trim() ?? ''
  if (id === '') {
    throw new Error('id sitasi wajib diisi dan tidak boleh kosong.')
  }

  const sourceId = input.sourceId?.trim() ?? ''
  if (sourceId === '') {
    throw new Error('sourceId sitasi wajib diisi dan tidak boleh kosong.')
  }

  const memberId = input.memberId?.trim() ?? ''
  if (memberId === '') {
    throw new Error('memberId sitasi wajib diisi dan tidak boleh kosong.')
  }

  const eventId = input.eventId?.trim() ?? ''
  if (eventId === '') {
    throw new Error('eventId sitasi wajib diisi dan tidak boleh kosong.')
  }

  const eventKind = input.eventKind?.trim() ?? ''
  if (!isEventKind(eventKind)) {
    throw new Error(
      'eventKind sitasi tidak dikenal: "' +
        String(input.eventKind) +
        '". Gunakan salah satu dari: BIRT, DEAT, MARR.',
    )
  }

  const quay = input.quay ?? 3
  if (!isQuayLevel(quay)) {
    throw new Error('quay sitasi harus bilangan bulat 0 sampai 3 (QUAY GEDCOM 7).')
  }

  return {
    id,
    sourceId,
    memberId,
    eventId,
    eventKind,
    quay,
    page: input.page,
    note: input.note,
  }
}

/** Opsi builder sitasi massal; quay dipakai untuk semua hasil. */
export interface BuildCitationsOptions {
  quay?: QuayLevel
}

/**
 * Petakan event milik satu anggota menjadi daftar citation berpola
 * SOUR/QUAY GEDCOM 7.
 *
 * Kombinasi yang dihasilkan: setiap event (BIRT/DEAT/MARR) dikali setiap
 * sourceId milik anggota yang ditemukan di katalog sources. sourceId yang
 * tidak ada di katalog dilewati agar tidak ada citation menggantung tanpa
 * record SOUR. Id hasil deterministik: cit-<member>-<kind>-<source>.
 */
export function buildCitationsForMember(
  member: Pick<FamilyMember, 'id' | 'sourceIds'>,
  events: readonly GenealogicalEvent[],
  sources: readonly GenealogicalSource[],
  options: BuildCitationsOptions = {},
): GenealogicalCitation[] {
  const quay = options.quay ?? 3
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const sourceIds = member.sourceIds ?? []
  const citations: GenealogicalCitation[] = []

  for (const event of events) {
    if (!isEventKind(event.kind)) {
      continue
    }
    for (const sourceId of sourceIds) {
      if (!sourceById.has(sourceId)) {
        continue
      }
      citations.push(
        makeCitation({
          id: 'cit-' + member.id + '-' + event.kind.toLowerCase() + '-' + sourceId,
          sourceId,
          memberId: member.id,
          eventId: event.id,
          eventKind: event.kind,
          quay,
        }),
      )
    }
  }

  return citations
}

/**
 * Render citation menjadi baris pola SOUR/QUAY GEDCOM 7.
 * PAGE ikut dibuat bila citation.page terisi.
 */
export function sourQuayLines(citation: GenealogicalCitation): string[] {
  const lines = [
    '1 SOUR @' + citation.sourceId + '@',
    '2 QUAY ' + String(citation.quay),
  ]
  if (citation.page !== undefined && citation.page !== '') {
    lines.push('2 PAGE ' + citation.page)
  }
  return lines
}
