// Perencana backfill place, murni tanpa DB (ADR 0011 keputusan 3 fase 2,
// item S1F2-C, saudara S1F2-B untuk tanggal). Skrip scripts/backfill-places.ts
// membaca LifeEvent anggota satu treeId beserta teks place legacy dari
// FamilyMember.birthPlace, lalu menyerahkan keputusan ke modul ini: place
// mana yang perlu dibuat, event mana yang di-link, dan event mana yang
// di-skip beserta alasannya. Modul ini TIDAK mengakses database, file, atau
// environment sehingga aman dijalankan ulang dan mudah diuji.
//
// Aturan rencana per event:
//   1. Event sudah punya placeId terisi -> skip 'already-linked'
//      (inilah kunci idempotensi antar-run).
//   2. Teks place kosong/null/whitespace -> skip 'empty-place'
//      (jangan mengarang nama tempat).
//   3. Selain itu -> link ke place berkunci normalizedName per treeId.
//      Bila kunci belum ada (baik di daftar place existing maupun di
//      rencana ini sendiri), place baru dijadwalkan lewat createPlaces.
//
// displayName adalah ejaan sumber setelah whitespace dirapikan (trim dan
// collapse beruntun menjadi satu spasi) sehingga kapital asli tetap tampil;
// normalizedName adalah versi lowercase dari displayName dan dipakai sebagai
// kunci dedupe per treeId, mengikuti @unique([treeId, normalizedName]) pada
// model Place. currentLocation TIDAK termasuk scope item ini.

/** Rapikan whitespace: trim lalu collapse beruntun menjadi satu spasi, kapital dibiarkan. */
export function collapsePlaceWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Normalisasi nama place untuk kunci pembanding: trim, collapse whitespace
 * beruntun menjadi satu spasi, lalu lowercase. Teks asli tetap dipertahankan
 * pemanggil untuk display (lihat collapsePlaceWhitespace dan hasil plan).
 * Null, undefined, atau teks kosong menghasilkan string kosong tanpa melempar.
 */
export function normalizePlaceName(raw: string | null | undefined): string {
  return collapsePlaceWhitespace(raw ?? '').toLowerCase()
}

/** Data event minimum yang diperlukan perencana. */
export interface PlaceBackfillEventInput {
  eventId: string
  treeId: string
  memberId: string
  eventType: string
  /** placeId yang sudah terisi pada LifeEvent; null/undefined bila belum. */
  existingPlaceId?: string | null
  /** Teks place sumber untuk event ini (mis. birthPlace member); null bila tidak ada. */
  placeText?: string | null
}

/** Place yang sudah ada di DB untuk satu tree; pasangan kunci dedupenya. */
export interface ExistingPlaceInput {
  treeId: string
  normalizedName: string
  /** Opsional, hanya untuk laporan: ejaan tampil place existing. */
  displayName?: string
}

/** Place baru yang perlu dibuat; unik per pasangan (treeId, normalizedName). */
export interface PlaceToCreate {
  treeId: string
  /** Ejaan sumber setelah whitespace dirapikan, kapital asli dipertahankan. */
  displayName: string
  /** Versi lowercase displayName; kunci unik per treeId. */
  normalizedName: string
}

/** Satu penulisan placeId ke LifeEvent. */
export interface PlaceLinkAction {
  eventId: string
  treeId: string
  memberId: string
  eventType: string
  /** Ejaan kanonikal place target, untuk laporan dan pembuatan place. */
  displayName: string
  normalizedName: string
  /** true bila place harus dibuat dulu (lihat createPlaces), false bila sudah ada di DB. */
  needsCreate: boolean
}

/** Satu event yang tidak jadi ditulis, beserta alasannya. */
export interface PlaceBackfillSkip {
  eventId: string
  treeId: string
  memberId: string
  eventType: string
  reason: 'already-linked' | 'empty-place'
}

/** Hasil perencanaan; createPlaces dan linkEvents ditulis skrip, skips hanya untuk laporan. */
export interface PlaceBackfillPlan {
  createPlaces: PlaceToCreate[]
  linkEvents: PlaceLinkAction[]
  skips: PlaceBackfillSkip[]
}

interface KnownPlace {
  kind: 'existing' | 'planned'
  displayName: string
}

function placeKey(treeId: string, normalizedName: string): string {
  return `${treeId}::${normalizedName}`
}

/**
 * Susun rencana backfill place dari daftar event. Murni: tanpa DB, tanpa
 * I/O, deterministik untuk input yang sama sehingga dipanggil dua kali
 * hasilnya identik. Dedupe memakai normalizedName per treeId: dua ejaan
 * yang berbeda kapital atau spasinya menunjuk place yang sama.
 */
export function buildPlaceBackfillPlan(
  events: readonly PlaceBackfillEventInput[],
  existingPlaces: readonly ExistingPlaceInput[] = [],
): PlaceBackfillPlan {
  const createPlaces: PlaceToCreate[] = []
  const linkEvents: PlaceLinkAction[] = []
  const skips: PlaceBackfillSkip[] = []

  const known = new Map<string, KnownPlace>()
  for (const place of existingPlaces) {
    const key = placeKey(place.treeId, normalizePlaceName(place.normalizedName))
    if (!known.has(key)) {
      known.set(key, { kind: 'existing', displayName: place.displayName ?? '' })
    }
  }

  for (const event of events) {
    if (typeof event.existingPlaceId === 'string' && event.existingPlaceId.trim().length > 0) {
      skips.push({
        eventId: event.eventId,
        treeId: event.treeId,
        memberId: event.memberId,
        eventType: event.eventType,
        reason: 'already-linked',
      })
      continue
    }

    const displayName = collapsePlaceWhitespace(event.placeText ?? '')
    if (displayName.length === 0) {
      skips.push({
        eventId: event.eventId,
        treeId: event.treeId,
        memberId: event.memberId,
        eventType: event.eventType,
        reason: 'empty-place',
      })
      continue
    }

    const normalizedName = normalizePlaceName(displayName)
    const key = placeKey(event.treeId, normalizedName)
    const seen = known.get(key)
    if (seen === undefined) {
      const planned: KnownPlace = { kind: 'planned', displayName }
      known.set(key, planned)
      createPlaces.push({ treeId: event.treeId, displayName, normalizedName })
    }
    linkEvents.push({
      eventId: event.eventId,
      treeId: event.treeId,
      memberId: event.memberId,
      eventType: event.eventType,
      displayName: seen !== undefined && seen.displayName.length > 0 ? seen.displayName : displayName,
      normalizedName,
      needsCreate: seen === undefined || seen.kind !== 'existing',
    })
  }

  return { createPlaces, linkEvents, skips }
}
