// Skrip backfill event keluarga idempoten add-only (v380, ADR 0011
// fase dual-read).
//
// Sumber: FamilyRelationship type 'spouse' + maritalStatus kedua member
// (aturan ever-married pola exportGedcom70.ts: married|widowed|divorced).
// Tujuan : LifeEvent eventType MARRIAGE/DIVORCE yang mengaitkan dua
//          member lewat memberId + partnerMemberId. Tanpa tanggal:
//          model FamilyMember tidak menyimpan tanggal pernikahan
//          (keterbatasan terdokumentasi di exportGedcom70.ts), jadi
//          tidak ada yang bisa di-backfill ke PartialDate.
//
// Jalan pakai:
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-family-events.ts --dry-run
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-family-events.ts
//
// Idempoten: sebelum menulis, skrip membaca LifeEvent MARRIAGE/DIVORCE
// yang sudah ada dan membangun kunci kanonik "idKecil|idBesar|TYPE"
// dari memberId + partnerMemberId dua arah; pasangan yang sudah punya
// event terkait di-skip (reason already-exists), jadi dijalankan ulang
// sebanyak apa pun hasilnya tetap sama (add-only, tidak ada update
// atau delete). Perencanaan murni ada di
// src/lib/gedcom/backfillFamilyPlan.ts (buildBackfillFamilyPlan,
// coupleKeyOf); file ini hanya I/O database dan pelaporan.

import { prisma } from '../server/db'
import {
  buildBackfillFamilyPlan,
  coupleKeyOf,
  type BackfillFamilyCoupleInput,
} from '../src/lib/gedcom/backfillFamilyPlan'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  const relationships = await prisma.familyRelationship.findMany({
    where: { type: 'spouse' },
    select: { treeId: true, memberId: true, relatedId: true },
    orderBy: { createdAt: 'asc' },
  })

  const memberIds = new Set<string>()
  for (const rel of relationships) {
    memberIds.add(rel.memberId)
    memberIds.add(rel.relatedId)
  }
  const members = await prisma.familyMember.findMany({
    where: { id: { in: [...memberIds] } },
    select: { id: true, maritalStatus: true },
  })
  const statusById = new Map(members.map((m) => [m.id, m.maritalStatus]))

  // Kunci existing dua arah: baris LifeEvent MARRIAGE/DIVORCE dengan
  // (memberId, partnerMemberId) mana pun arahnya masuk kunci kanonik.
  const existingEvents = await prisma.lifeEvent.findMany({
    where: { eventType: { in: ['MARRIAGE', 'DIVORCE'] }, partnerMemberId: { not: null } },
    select: { memberId: true, partnerMemberId: true, eventType: true },
  })
  const existingKeys = existingEvents.map((e) =>
    `${coupleKeyOf(e.memberId, e.partnerMemberId as string)}|${e.eventType}`,
  )

  const inputs: BackfillFamilyCoupleInput[] = relationships.map((rel) => ({
    treeId: rel.treeId,
    memberAId: rel.memberId,
    memberBId: rel.relatedId,
    statusA: statusById.get(rel.memberId) ?? 'single',
    statusB: statusById.get(rel.relatedId) ?? 'single',
    existingEventKeys: existingKeys,
  }))
  const plan = buildBackfillFamilyPlan(inputs)

  const marriageActions = plan.actions.filter((a) => a.eventType === 'MARRIAGE').length
  const divorceActions = plan.actions.length - marriageActions
  const skipExists = plan.skips.filter((s) => s.reason === 'already-exists').length
  const skipEmpty = plan.skips.length - skipExists

  console.log(`Relasi spouse dibaca        : ${relationships.length}`)
  console.log(`Rencana buat LifeEvent      : ${plan.actions.length} (MARRIAGE ${marriageActions}, DIVORCE ${divorceActions})`)
  console.log(`Skip sudah ada (idem)       : ${skipExists}`)
  console.log(`Skip sumber kosong          : ${skipEmpty}`)
  console.log('Contoh rencana (maks 5):')
  for (const action of plan.actions.slice(0, 5)) {
    console.log(`  tree=${action.treeId} | ${action.memberId} + ${action.partnerMemberId} | ${action.eventType}`)
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
        partnerMemberId: action.partnerMemberId,
        eventType: action.eventType,
      },
    })
    created += 1
  }
  console.log(`Selesai: ${created} LifeEvent keluarga dibuat. Tidak ada data lama yang diubah.`)
}

main().catch((error: unknown) => {
  console.error('Backfill keluarga gagal:', error)
  process.exit(1)
})
