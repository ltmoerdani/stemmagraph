// Perencana backfill event keluarga, murni tanpa DB (v380, ADR 0011
// fase dual-read, lanjutan S1F2-B).
//
// Skrip scripts/backfill-family-events.ts membaca FamilyRelationship,
// FamilyMember, dan LifeEvent lewat PrismaClient, lalu menyerahkan
// keputusan ke modul ini: pasangan mana yang butuh LifeEvent
// MARRIAGE/DIVORCE baru, dan kolom PartialDate apa yang harus dibuat.
// Modul ini TIDAK mengakses database, file, atau environment sehingga
// aman dijalankan ulang dan mudah diuji (idempotensi penuh ada di
// skrip: add-only, skip yang sudah ada).
//
// Aturan rencana per pasangan (sumber: FamilyRelationship type 'spouse'):
//   1. Normalisasi arah: pasangan A-B dan B-A adalah SATU pasangan;
//      urutan kanonik memakai memberId terkecil lebih dulu (pola
//      coupleKey exportGedcom70.ts).
//   2. Pasangan sudah punya LifeEvent MARRIAGE dengan pasangan sama
//      (memberId + partnerMemberId, dua arah) -> skip 'already-exists'
//      (inilah kunci idempotensi antar-run).
//   3. Sumber status kosong: kedua member tidak berstatus
//      married/widowed/divorced -> skip 'empty-source' (tidak ada yang
//      bisa di-backfill; jangan mengarang status pernikahan). Status
//      ikut aturan exportGedcom70.ts: married/widowed/divorced berarti
//      pernah menikah, divorced saja yang memicu slot DIVORCE.
//   4. Selain itu -> satu aksi MARRIAGE (dan DIVORCE bila ada yang
//      divorced) dengan date null (model FamilyMember tidak menyimpan
//      tanggal pernikahan; dokumentasi exportGedcom70 MARR/DIV).
//
// Skrip add-only: tidak ada update atau delete. Perilaku backfill
// BIRTH/DEATH existing di src/lib/gedcom/backfillPlan.ts TIDAK
// disentuh sama sekali.

/** eventType keluarga yang dibuat oleh backfill keluarga v380. */
export const BACKFILL_FAMILY_EVENT_TYPES = ['MARRIAGE', 'DIVORCE'] as const

export type BackfillFamilyEventType = (typeof BACKFILL_FAMILY_EVENT_TYPES)[number]

/** Data pasangan minimum yang diperlukan perencana. */
export interface BackfillFamilyCoupleInput {
  treeId: string
  /** Dua member id pasangan, urutan bebas (dinormalisasi di sini). */
  memberAId: string
  memberBId: string
  /** maritalStatus memberA (aturan ever-married: married|widowed|divorced). */
  statusA: string
  /** maritalStatus memberB. */
  statusB: string
  /**
   * Pasangan (dua arah) yang sudah punya eventType terkait; dari tabel
   * LifeEvent. Kunci "idKecil|idBesar" seperti kunci rencana.
   */
  existingEventKeys?: readonly string[]
}

/** Satu aksi penulisan event keluarga; date null, model tak menyimpannya. */
export interface BackfillFamilyAction {
  treeId: string
  memberId: string
  partnerMemberId: string
  eventType: BackfillFamilyEventType
  /**
   * Selalu null di fase ini: FamilyMember tidak menyimpan tanggal
   * pernikahan atau perceraian (keterbatasan model terdokumentasi di
   * exportGedcom70.ts), jadi tidak ada yang bisa di-parse.
   */
  date: null
}

/** Satu slot yang tidak jadi ditulis, beserta alasannya. */
export interface BackfillFamilySkip {
  treeId: string
  memberId: string
  partnerMemberId: string
  eventType: BackfillFamilyEventType
  reason: 'already-exists' | 'empty-source'
}

/** Hasil perencanaan; actions ditulis skrip, skips hanya untuk laporan. */
export interface BackfillFamilyPlan {
  actions: BackfillFamilyAction[]
  skips: BackfillFamilySkip[]
}

/** Status yang dianggap pernah menikah, pola exportGedcom70.ts. */
export const EVER_MARRIED_STATUSES = ['married', 'widowed', 'divorced'] as const

/** Status yang memicu slot DIVORCE. */
export const DIVORCED_STATUS = 'divorced'

/** Kunci kanonik pasangan: id kecil dulu, dipisah pipa. */
export function coupleKeyOf(memberAId: string, memberBId: string): string {
  return memberAId < memberBId
    ? `${memberAId}|${memberBId}`
    : `${memberBId}|${memberAId}`
}

function isEverMarried(statusA: string, statusB: string): boolean {
  return (
    (EVER_MARRIED_STATUSES as readonly string[]).includes(statusA) ||
    (EVER_MARRIED_STATUSES as readonly string[]).includes(statusB)
  )
}

function isDivorced(statusA: string, statusB: string): boolean {
  return statusA === DIVORCED_STATUS || statusB === DIVORCED_STATUS
}

/**
 * Susun rencana backfill keluarga dari daftar pasangan. Murni: tanpa
 * DB, tanpa I/O, hasil deterministik untuk input yang sama. Urutan
 * output mengikuti urutan input; pasangan ganda (A-B dan B-A)
 * didedup ke satu entri, entri pertama yang menang.
 */
export function buildBackfillFamilyPlan(
  couples: readonly BackfillFamilyCoupleInput[],
): BackfillFamilyPlan {
  const actions: BackfillFamilyAction[] = []
  const skips: BackfillFamilySkip[] = []
  const seen = new Set<string>()

  for (const couple of couples) {
    const key = coupleKeyOf(couple.memberAId, couple.memberBId)

    // Dedup arah: A-B dan B-A satu pasangan, proses sekali.
    if (seen.has(key)) continue
    seen.add(key)

    const [memberId, partnerMemberId] = key.split('|')

    // Slot MARRIAGE: skip bila sudah ada event MARRIAGE untuk pasangan
    // ini (dua arah sudah dinormalisasi saat skrip membangun kunci).
    if ((couple.existingEventKeys ?? []).includes(`${key}|MARRIAGE`)) {
      skips.push({
        treeId: couple.treeId,
        memberId,
        partnerMemberId,
        eventType: 'MARRIAGE',
        reason: 'already-exists',
      })
    } else if (!isEverMarried(couple.statusA, couple.statusB)) {
      // Tidak ada bukti pernikahan di maritalStatus: jangan mengarang.
      skips.push({
        treeId: couple.treeId,
        memberId,
        partnerMemberId,
        eventType: 'MARRIAGE',
        reason: 'empty-source',
      })
    } else {
      actions.push({
        treeId: couple.treeId,
        memberId,
        partnerMemberId,
        eventType: 'MARRIAGE',
        date: null,
      })
    }

    // Slot DIVORCE: hanya bila ada status divorced.
    if (isDivorced(couple.statusA, couple.statusB)) {
      if ((couple.existingEventKeys ?? []).includes(`${key}|DIVORCE`)) {
        skips.push({
          treeId: couple.treeId,
          memberId,
          partnerMemberId,
          eventType: 'DIVORCE',
          reason: 'already-exists',
        })
      } else {
        actions.push({
          treeId: couple.treeId,
          memberId,
          partnerMemberId,
          eventType: 'DIVORCE',
          date: null,
        })
      }
    }
  }

  return { actions, skips }
}
