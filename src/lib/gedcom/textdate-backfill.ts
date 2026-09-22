// Bridge parser tanggal teks legacy (v145-i) ke kolom PartialDate backfill
// (v145-ii, ADR 0011 fase 2). Modul pure: tanpa import dari server/, store,
// atau dependensi eksternal.
//
// Alur: teks legacy -> parseTextDate (S1F2-A gaya v145-i, hasil
// GenealogicalDate) -> genealogicalDateToPartialDateColumns -> kolom
// PartialDate yang siap dipakai create Prisma oleh skrip backfill.
//
// Pemetaan modifier GenealogicalDate ke dateKind PartialDate:
//   exact      -> EXACT   (year ke yearStart)
//   calculated -> ABOUT   (year ke yearStart)
//   estimated  -> ABOUT   (year ke yearStart)
//   about      -> ABOUT   (year ke yearStart bila ada)
//   from       -> AFTER   (year ke yearStart)
//   to         -> BEFORE  (year ke yearStart)
//   range      -> RANGE   (year ke yearStart, year2 ke yearEnd)
//   about tanpa year (phrase tak terurai) -> ABOUT, semua kolom angka null.
//
// originalDateString menyimpan teks terverifikasi: phrase asli bila ada,
// selain itu hasil formatHuman(g).
//
// Slot kosong/null/whitespace atau hasil parser null masuk skips dengan
// alasan 'empty-source' (satu-satunya alasan non-aksi di kontrak
// BackfillSkip; modul ini tidak pernah mengarang tanggal).

import type { GenealogicalDate } from '../genealogy/genealogical-date'
import { formatHuman } from '../genealogy/genealogical-date'
import { parseTextDate } from '../genealogy/textdate-parser'
import type {
  BackfillMemberInput,
  BackfillPlan,
  PartialDateColumns,
} from './backfillPlan'

/**
 * Konversi GenealogicalDate hasil parser v145-i ke kolom PartialDate.
 * Pure: tidak mengubah input, tidak punya efek samping.
 */
export function genealogicalDateToPartialDateColumns(
  g: GenealogicalDate,
): PartialDateColumns {
  const originalDateString = g.phrase ?? formatHuman(g)

  const emptyNumeric = {
    monthStart: null,
    dayStart: null,
    monthEnd: null,
    dayEnd: null,
  } as const

  switch (g.modifier) {
    case 'exact':
      return {
        dateKind: 'EXACT',
        yearStart: g.year ?? null,
        ...emptyNumeric,
        yearEnd: null,
        originalDateString,
      }
    case 'calculated':
    case 'estimated':
    case 'about':
      return {
        dateKind: 'ABOUT',
        yearStart: g.year ?? null,
        ...emptyNumeric,
        yearEnd: null,
        originalDateString,
      }
    case 'from':
      return {
        dateKind: 'AFTER',
        yearStart: g.year ?? null,
        ...emptyNumeric,
        yearEnd: null,
        originalDateString,
      }
    case 'to':
      return {
        dateKind: 'BEFORE',
        yearStart: g.year ?? null,
        ...emptyNumeric,
        yearEnd: null,
        originalDateString,
      }
    case 'range':
      return {
        dateKind: 'RANGE',
        yearStart: g.year ?? null,
        ...emptyNumeric,
        yearEnd: g.year2 ?? null,
        originalDateString,
      }
  }
}

/**
 * Perencana backfill berteknologi parser v145-i: parse tiap slot tanggal
 * legacy lalu delegasi konversi ke genealogicalDateToPartialDateColumns.
 * Slot kosong/null/whitespace atau gagal parse (parser null) masuk skips,
 * bukan actions; urutan hasil deterministik mengikuti urutan input.
 */
export function buildTextDateBackfillPlan(
  members: BackfillMemberInput[],
): BackfillPlan {
  const actions: BackfillPlan['actions'] = []
  const skips: BackfillPlan['skips'] = []

  for (const member of members) {
    const slots = [
      { eventType: 'BIRTH' as const, source: member.birthDate },
      { eventType: 'DEATH' as const, source: member.deathDate },
    ]

    for (const slot of slots) {
      if (slot.source === null || slot.source.trim().length === 0) {
        skips.push({
          memberId: member.id,
          memberName: member.name,
          eventType: slot.eventType,
          reason: 'empty-source',
        })
        continue
      }

      const parsed = parseTextDate(slot.source)
      if (parsed === null) {
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
        date: genealogicalDateToPartialDateColumns(parsed),
      })
    }
  }

  return { actions, skips }
}
