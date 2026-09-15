// Perencana backfill tanggal genealogi, murni tanpa DB (ADR 0011 fase 2,
// S1F2-B, lanjutan S1F2-A parser).
//
// Skrip scripts/backfill-genealogy.ts membaca FamilyMember dan LifeEvent
// lewat PrismaClient, lalu menyerahkan keputusan ke modul ini: member mana
// yang butuh LifeEvent BIRTH/DEATH baru, apa hasil urai tanggalnya, dan
// kolom PartialDate apa yang harus dibuat. Modul ini TIDAK mengakses
// database, file, atau environment sehingga aman dijalankan ulang dan
// mudah diuji (idempotensi penuh ada di skrip: add-only, skip yang sudah ada).
//
// Aturan rencana per member, untuk slot BIRTH (sumber: birthDate) dan slot
// DEATH (sumber: deathDate):
//   1. Member sudah punya LifeEvent dengan eventType terkait -> skip
//      'already-exists' (inilah kunci idempotensi antar-run).
//   2. Teks sumber kosong/null/whitespace -> skip 'empty-source' (tidak ada
//      yang bisa di-backfill; jangan mengarang tanggal).
//   3. Selain itu -> satu aksi dengan hasil parseEventDate (S1F2-A);
//      originalDateString dijamin verbatim, gagal urai tetap jadi aksi
//      dengan dateKind ABOUT tanpa komponen (parser tidak melempar).

import { parseEventDate, type ParsedEventDate } from './parseEventDate'

/** eventType yang dibuat oleh backfill fase 2. */
export const BACKFILL_EVENT_TYPES = ['BIRTH', 'DEATH'] as const

export type BackfillEventType = (typeof BACKFILL_EVENT_TYPES)[number]

/** Data member minimum yang diperlukan perencana. */
export interface BackfillMemberInput {
  id: string
  treeId: string
  name: string
  /** Teks tanggal lahir legacy; boleh string kosong. */
  birthDate: string
  /** Teks tanggal wafat legacy; null bila tidak tercatat. */
  deathDate: string | null
  /** eventType yang sudah ada untuk member ini; dari tabel LifeEvent. */
  existingEventTypes?: readonly string[]
}

/** Satu aksi penulisan: satu PartialDate + satu LifeEvent. */
export interface BackfillAction {
  memberId: string
  treeId: string
  memberName: string
  eventType: BackfillEventType
  /** Hasil urai S1F2-A; originalDateString verbatim dari teks sumber. */
  date: ParsedEventDate
}

/** Satu slot yang tidak jadi ditulis, beserta alasannya. */
export interface BackfillSkip {
  memberId: string
  memberName: string
  eventType: BackfillEventType
  reason: 'already-exists' | 'empty-source'
}

/** Hasil perencanaan; actions ditulis skrip, skips hanya untuk laporan. */
export interface BackfillPlan {
  actions: BackfillAction[]
  skips: BackfillSkip[]
}

/** Kolom PartialDate hasil konversi ParsedEventDate (input create Prisma). */
export interface PartialDateColumns {
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
  yearEnd: number | null
  monthEnd: number | null
  dayEnd: number | null
  originalDateString: string
}

function colsFromComponents(components: {
  year?: number
  month?: number
  day?: number
}): Pick<PartialDateColumns, 'yearStart' | 'monthStart' | 'dayStart'> {
  return {
    yearStart: components.year ?? null,
    monthStart: components.month ?? null,
    dayStart: components.day ?? null,
  }
}

/**
 * Konversi hasil parseEventDate ke kolom PartialDate skema fase 2.
 * RANGE memakai from -> kolom *Start dan to -> kolom *End; kind lain hanya
 * mengisi kolom *Start (year wajib kecuali ABOUT tanpa komponen).
 * originalDateString diteruskan verbatim, tanpa potong atau rapikan.
 */
export function toPartialDateColumns(date: ParsedEventDate): PartialDateColumns {
  const base: PartialDateColumns = {
    dateKind: date.dateKind,
    yearStart: null,
    monthStart: null,
    dayStart: null,
    yearEnd: null,
    monthEnd: null,
    dayEnd: null,
    originalDateString: date.originalDateString,
  }

  if (date.dateKind === 'RANGE') {
    return {
      ...base,
      ...colsFromComponents(date.from),
      yearEnd: date.to.year ?? null,
      monthEnd: date.to.month ?? null,
      dayEnd: date.to.day ?? null,
    }
  }

  // EXACT/ABOUT/BEFORE/AFTER memakai komponen level atas.
  return { ...base, ...colsFromComponents(date) }
}

/**
 * Susun rencana backfill dari daftar member. Murni: tanpa DB, tanpa I/O,
 * hasil deterministik untuk input yang sama.
 */
export function buildBackfillPlan(members: readonly BackfillMemberInput[]): BackfillPlan {
  const actions: BackfillAction[] = []
  const skips: BackfillSkip[] = []

  for (const member of members) {
    const existing = new Set(member.existingEventTypes ?? [])
    const slots: Array<{ eventType: BackfillEventType; source: string | null }> = [
      { eventType: 'BIRTH', source: member.birthDate },
      { eventType: 'DEATH', source: member.deathDate },
    ]

    for (const slot of slots) {
      if (existing.has(slot.eventType)) {
        skips.push({
          memberId: member.id,
          memberName: member.name,
          eventType: slot.eventType,
          reason: 'already-exists',
        })
        continue
      }

      const source = slot.source ?? ''
      if (source.trim().length === 0) {
        skips.push({
          memberId: member.id,
          memberName: member.name,
          eventType: slot.eventType,
          reason: 'empty-source',
        })
        continue
      }

      actions.push({
        memberId: member.id,
        treeId: member.treeId,
        memberName: member.name,
        eventType: slot.eventType,
        date: parseEventDate(source),
      })
    }
  }

  return { actions, skips }
}
