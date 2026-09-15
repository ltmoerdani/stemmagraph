// Skrip backfill place idempoten add-only (ADR 0011 keputusan 3 fase 2,
// item S1F2-C). Mengikuti pola scripts/backfill-genealogy.ts (S1F2-B).
//
// Sumber: FamilyMember.birthPlace (teks legacy) untuk LifeEvent BIRTH
//         anggota terkait.
// Tujuan : Place (displayName ejaan sumber setelah whitespace dirapikan,
//          normalizedName sebagai kunci dedupe per tree)
//          + LifeEvent.placeId yang terhubung ke event.
//
// Jalan pakai:
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-places.ts            (dry-run, default)
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-places.ts --dry-run  (sama dengan default)
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/backfill-places.ts --apply    (benar-benar menulis)
//
// Dry-run adalah default: tanpa flag apa pun skrip hanya mencetak rencana.
// Penulisan ke database hanya terjadi bila flag --apply diberikan.
//
// Idempoten: event yang sudah punya placeId di-skip (reason already-linked);
// place ditulis lewat upsert pada kunci unik (treeId, normalizedName) tanpa
// pernah menimpa displayName lama, jadi dijalankan ulang sebanyak apa pun
// tidak membuat place ganda dan tidak mengubah data lama. Perencanaan murni
// ada di src/lib/gedcom/placeBackfillPlan.ts (buildPlaceBackfillPlan);
// file ini hanya I/O database dan pelaporan. currentLocation tidak termasuk
// scope item ini.

import { prisma } from '../server/db'
import {
  buildPlaceBackfillPlan,
  type PlaceBackfillEventInput,
} from '../src/lib/gedcom/placeBackfillPlan'

async function main(): Promise<void> {
  // --dry-run diterima untuk kejelasan, padahal memang default; hanya
  // --apply yang menulis.
  const dryRun = !process.argv.includes('--apply')

  const members = await prisma.familyMember.findMany({
    select: { id: true, treeId: true, name: true, birthPlace: true },
    orderBy: { createdAt: 'asc' },
  })
  const memberById = new Map(members.map((member) => [member.id, member]))

  const events = await prisma.lifeEvent.findMany({
    select: { id: true, treeId: true, memberId: true, eventType: true, placeId: true },
    orderBy: { createdAt: 'asc' },
  })

  const existingPlaces = await prisma.place.findMany({
    select: { id: true, treeId: true, displayName: true, normalizedName: true },
    orderBy: { createdAt: 'asc' },
  })

  const inputs: PlaceBackfillEventInput[] = events.map((event) => ({
    eventId: event.id,
    treeId: event.treeId,
    memberId: event.memberId,
    eventType: event.eventType,
    existingPlaceId: event.placeId,
    placeText:
      event.eventType === 'BIRTH' ? memberById.get(event.memberId)?.birthPlace ?? null : null,
  }))
  const plan = buildPlaceBackfillPlan(
    inputs,
    existingPlaces.map((place) => ({
      treeId: place.treeId,
      normalizedName: place.normalizedName,
      displayName: place.displayName,
    })),
  )

  const skipLinked = plan.skips.filter((s) => s.reason === 'already-linked').length
  const skipEmpty = plan.skips.length - skipLinked

  console.log(`FamilyMember dibaca        : ${members.length}`)
  console.log(`LifeEvent dibaca           : ${events.length}`)
  console.log(`Rencana buat Place         : ${plan.createPlaces.length}`)
  console.log(`Rencana link LifeEvent     : ${plan.linkEvents.length}`)
  console.log(`Skip sudah terlink (idem)  : ${skipLinked}`)
  console.log(`Skip teks place kosong     : ${skipEmpty}`)
  console.log('Contoh place baru (maks 5):')
  for (const place of plan.createPlaces.slice(0, 5)) {
    console.log(`  tree ${place.treeId} | "${place.displayName}" | kunci "${place.normalizedName}"`)
  }

  if (dryRun) {
    console.log('Dry-run: tidak ada data yang ditulis ke database. Gunakan --apply untuk menulis.')
    return
  }

  const placeIdByKey = new Map<string, string>()
  for (const place of existingPlaces) {
    placeIdByKey.set(`${place.treeId}::${place.normalizedName}`, place.id)
  }

  let upserted = 0
  for (const place of plan.createPlaces) {
    const key = `${place.treeId}::${place.normalizedName}`
    // Add-only: update kosong, displayName place lama tidak pernah ditimpa.
    const row = await prisma.place.upsert({
      where: {
        treeId_normalizedName: { treeId: place.treeId, normalizedName: place.normalizedName },
      },
      create: {
        treeId: place.treeId,
        displayName: place.displayName,
        normalizedName: place.normalizedName,
      },
      update: {},
    })
    placeIdByKey.set(key, row.id)
    upserted += 1
  }

  let linked = 0
  for (const link of plan.linkEvents) {
    const placeId = placeIdByKey.get(`${link.treeId}::${link.normalizedName}`)
    if (placeId === undefined) {
      console.warn(
        `Lewati event ${link.eventId}: placeId tidak ditemukan untuk kunci "${link.normalizedName}"`,
      )
      continue
    }
    await prisma.lifeEvent.update({
      where: { id: link.eventId },
      data: { placeId },
    })
    linked += 1
  }

  console.log(
    `Selesai: ${upserted} Place di-upsert, ${linked} LifeEvent di-link. Tidak ada data lama yang diubah.`,
  )
}

main().catch((error: unknown) => {
  console.error('Backfill gagal:', error)
  process.exit(1)
})
