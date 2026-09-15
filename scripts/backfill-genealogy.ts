// Skrip backfill genealogi idempoten add-only (ADR 0011 fase 2, S1F2-B).
//
// Sumber: FamilyMember.birthDate / deathDate (teks legacy).
// Tujuan : PartialDate (originalDateString VERBATIM, tidak pernah ditimpa)
//          + LifeEvent eventType BIRTH/DEATH yang terhubung ke member.
//
// Jalan pakai:
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-genealogy.ts --dry-run
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-genealogy.ts
//
// Idempoten: sebelum menulis, skrip membaca LifeEvent BIRTH/DEATH yang sudah
// ada; member yang sudah punya event terkait di-skip (reason already-exists),
// jadi dijalankan ulang sebanyak apa pun hasilnya tetap sama (add-only,
// tidak ada update atau delete). Perencanaan murni ada di
// src/lib/gedcom/backfillPlan.ts (buildBackfillPlan, toPartialDateColumns);
// file ini hanya I/O database dan pelaporan.

import { prisma } from '../server/db'
import {
  buildBackfillPlan,
  toPartialDateColumns,
  type BackfillMemberInput,
} from '../src/lib/gedcom/backfillPlan'
import type { ParsedEventDate } from '../src/lib/gedcom/parseEventDate'

/** Ringkas hasil parse untuk contoh di laporan dry-run. */
function describeParse(date: ParsedEventDate): string {
  if (date.dateKind === 'RANGE') {
    return `RANGE ${date.from.year ?? '?'} s.d. ${date.to.year ?? '?'}`
  }
  const y = 'year' in date && date.year !== undefined ? date.year : '?'
  const m = 'month' in date && date.month !== undefined ? `-${String(date.month).padStart(2, '0')}` : ''
  const d = 'day' in date && date.day !== undefined ? `-${String(date.day).padStart(2, '0')}` : ''
  return `${date.dateKind} ${y}${m}${d}`
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  const members = await prisma.familyMember.findMany({
    select: { id: true, treeId: true, name: true, birthDate: true, deathDate: true },
    orderBy: { createdAt: 'asc' },
  })

  const existingEvents = await prisma.lifeEvent.findMany({
    where: { eventType: { in: ['BIRTH', 'DEATH'] } },
    select: { memberId: true, eventType: true },
  })
  const existingByMember = new Map<string, string[]>()
  for (const event of existingEvents) {
    const list = existingByMember.get(event.memberId) ?? []
    list.push(event.eventType)
    existingByMember.set(event.memberId, list)
  }

  const inputs: BackfillMemberInput[] = members.map((member) => ({
    id: member.id,
    treeId: member.treeId,
    name: member.name,
    birthDate: member.birthDate,
    deathDate: member.deathDate,
    existingEventTypes: existingByMember.get(member.id) ?? [],
  }))
  const plan = buildBackfillPlan(inputs)

  const birthActions = plan.actions.filter((a) => a.eventType === 'BIRTH').length
  const deathActions = plan.actions.length - birthActions
  const skipExists = plan.skips.filter((s) => s.reason === 'already-exists').length
  const skipEmpty = plan.skips.length - skipExists

  console.log(`Member dibaca           : ${members.length}`)
  console.log(`Rencana buat LifeEvent  : ${plan.actions.length} (BIRTH ${birthActions}, DEATH ${deathActions})`)
  console.log(`Skip sudah ada (idem)   : ${skipExists}`)
  console.log(`Skip sumber kosong      : ${skipEmpty}`)
  console.log('Contoh hasil parse (maks 5):')
  for (const action of plan.actions.slice(0, 5)) {
    console.log(`  ${action.memberName} | ${action.eventType} | "${action.date.originalDateString}" -> ${describeParse(action.date)}`)
  }

  if (dryRun) {
    console.log('Dry-run: tidak ada data yang ditulis ke database.')
    return
  }

  let created = 0
  for (const action of plan.actions) {
    await prisma.lifeEvent.create({
      data: {
        treeId: action.treeId,
        memberId: action.memberId,
        eventType: action.eventType,
        date: { create: toPartialDateColumns(action.date) },
      },
    })
    created += 1
  }
  console.log(`Selesai: ${created} PartialDate + ${created} LifeEvent dibuat. Tidak ada data lama yang diubah.`)
}

main().catch((error: unknown) => {
  console.error('Backfill gagal:', error)
  process.exit(1)
})
