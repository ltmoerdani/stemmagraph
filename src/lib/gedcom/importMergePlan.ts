// Stemmagraph v373: rencana merge import GEDCOM ke pohon existing (GAP #2).
//
// Dasar: GEDCOM 7.0.18 bagian 1.3, xref hanya unik dalam satu data
// document dan tidak di-retain antar data stream, jadi xref dilarang
// jadi kunci penggabungan dua berkas. Identitas lintas berkas hanya
// lewat UID, EXID, REFN (techfaqs gedcom.io). Modul ini pure: tanpa
// DB, tanpa env, tanpa network, tanpa side effect, tidak pernah throw.
//
// Aturan inti:
//   1. SEMUA xref berkas masuk di-remap ke ID internal baru tanpa
//      tabrakan, referensi pointer ikut terpetakan lewat xrefMap.
//   2. Pencocokan durable berprioritas eksplisit: EXID bertipe dulu,
//      lalu UID, lalu REFN. Hasil pencocokan hanya KANDIDAT, tanpa
//      auto-merge, keputusan final milik pemanggil.
//   3. Struktur tak dikenal masuk extensionPayloads, tidak menggagalkan.
//   4. Urutan preferensi terjaga: nilai pertama bertipe sama menang,
//      urutan pointer anak FAM.CHIL dipertahankan apa adanya.

/** Record masuk hasil parse rantai import, diperkaya jalur aditif. */
export interface IncomingRecord {
  source: 'INDI' | 'FAM'
  /** Xref sumber tanpa pagar @, boleh undefined. */
  xref?: string
  uid?: string
  /** EXID terstruktur; hanya bertipe yang dipakai pencocokan. */
  exids?: IncomingExid[]
  refn?: string
  /** Urutan pointer anak FAM.CHIL sumber, dipertahankan apa adanya. */
  childrenXrefs?: string[]
  /** Tag atau struktur tak dikenal, disimpan apa adanya untuk 7.1. */
  unknownTags?: string[]
}

export interface IncomingExid {
  /** Tipe EXID, misal FamilySearch ID. Kosong berarti tak dikenal. */
  type?: string
  value: string
}

/** Indeks identitas durable pohon existing, hasil kueri pemanggil. */
export interface ExistingIdentityIndex {
  /** Kunci: type + '::' + value EXID. Nilai: id internal existing. */
  byExid?: Record<string, string>
  byUid?: Record<string, string>
  byRefn?: Record<string, string>
  /** Semua id internal yang sudah dipakai pohon existing. */
  usedIds?: string[]
  /** Nomor awal counter ID baru, default 1. */
  startCounter?: number
}

/** Status satu entri rencana merge. Tidak ada status MERGED otomatis. */
export type MergeEntryStatus = 'NEW' | 'MATCH_CANDIDATE' | 'SKIPPED'

export interface MergePlanEntry {
  source: 'INDI' | 'FAM'
  incomingXref: string | undefined
  /** ID internal baru hasil remap, selalu ada untuk entri non-skip. */
  newInternalId: string | undefined
  status: MergeEntryStatus
  /** Jalur pencocokan durable yang menang, kalau ada. */
  matchType?: 'EXID' | 'UID' | 'REFN'
  /** Kandidat record existing yang sama, tanpa auto-merge. */
  matchedExistingId?: string
  /** Alasan skip untuk input rusak. */
  skipReason?: string
  /** Struktur tak dikenal disimpan untuk masa depan (GEDCOM 7.1). */
  extensionPayloads: string[]
}

export interface MergePlan {
  entries: MergePlanEntry[]
  /** Peta xref sumber ke ID internal baru, referensi pointer ikut ini. */
  xrefMap: Record<string, string>
  skipped: MergePlanEntry[]
}

/** Kunci EXID bertipe untuk indeks pencocokan. */
function exidKey(exid: IncomingExid): string | null {
  if (exid.type === undefined || exid.type.trim() === '' || exid.value.trim() === '') {
    return null
  }
  return `${exid.type.trim()}::${exid.value.trim()}`
}

/**
 * Pencocokan durable berprioritas tetap: EXID bertipe, lalu UID, lalu
 * REFN. Mengembalikan kecocokan pertama yang ditemukan, bukan gabungan
 * semua jalur.
 */
function findDurableMatch(
  record: IncomingRecord,
  existing: ExistingIdentityIndex,
): { matchType: 'EXID' | 'UID' | 'REFN'; existingId: string } | null {
  const exids = record.exids ?? []
  for (const exid of exids) {
    const key = exidKey(exid)
    if (key !== null && existing.byExid && existing.byExid[key] !== undefined) {
      return { matchType: 'EXID', existingId: existing.byExid[key] }
    }
  }
  if (record.uid !== undefined && record.uid.trim() !== '' && existing.byUid) {
    const hit = existing.byUid[record.uid.trim()]
    if (hit !== undefined) {
      return { matchType: 'UID', existingId: hit }
    }
  }
  if (record.refn !== undefined && record.refn.trim() !== '' && existing.byRefn) {
    const hit = existing.byRefn[record.refn.trim()]
    if (hit !== undefined) {
      return { matchType: 'REFN', existingId: hit }
    }
  }
  return null
}

/**
 * Urutan preferensi GEDCOM 7 bagian 1.2: substructure bertipe sama,
 * yang pertama paling diutamakan. Nilai terisi pertama menang, tanpa
 * pernah melempar.
 */
export function firstPreferred<T>(values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value
    }
  }
  return undefined
}

/**
 * Memetakan satu pointer sumber lewat xrefMap hasil remap. Pointer ke
 * xref yang tak terdaftar dikembalikan apa adanya agar pemanggil bisa
 * menilai, sesuai pola kejujuran importPlan (unknown-xref tidak
 * difabrikasi).
 */
export function remapPointer(pointer: string, xrefMap: Record<string, string>): string {
  return xrefMap[pointer] ?? pointer
}

function skippedEntry(
  source: 'INDI' | 'FAM',
  xref: string | undefined,
  reason: string,
): MergePlanEntry {
  return {
    source,
    incomingXref: xref,
    newInternalId: undefined,
    status: 'SKIPPED',
    skipReason: reason,
    extensionPayloads: [],
  }
}

/**
 * Membangun rencana merge. Tidak pernah melempar: entri rusak masuk
 * skipped dengan alasan, sisanya tetap direncanakan.
 */
export function buildMergePlan(
  incoming: unknown,
  existing: ExistingIdentityIndex,
): MergePlan {
  const entries: MergePlanEntry[] = []
  const skipped: MergePlanEntry[] = []
  const xrefMap: Record<string, string> = {}
  const used = new Set<string>(existing.usedIds ?? [])
  let counter = existing.startCounter ?? 1

  if (!Array.isArray(incoming)) {
    const invalid = skippedEntry('INDI', undefined, 'invalid-input')
    return { entries: [invalid], xrefMap, skipped: [invalid] }
  }

  for (const raw of incoming) {
    const record = raw as IncomingRecord | null | undefined
    if (record === null || record === undefined || typeof record !== 'object') {
      const invalid = skippedEntry('INDI', undefined, 'invalid-record')
      skipped.push(invalid)
      entries.push(invalid)
      continue
    }
    if (record.source !== 'INDI' && record.source !== 'FAM') {
      const invalid = skippedEntry('INDI', record.xref, 'unknown-source')
      skipped.push(invalid)
      entries.push(invalid)
      continue
    }

    // Remap wajib: xref masuk selalu dapat ID internal baru, tanpa
    // memandang kecocokan durable. Kecocokan hanya kandidat merge.
    let newId: string | undefined
    if (record.xref !== undefined && record.xref.trim() !== '') {
      let candidate = `@M${counter}@`
      while (used.has(candidate)) {
        counter = counter + 1
        candidate = `@M${counter}@`
      }
      newId = candidate
      used.add(candidate)
      xrefMap[record.xref.trim()] = candidate
      counter = counter + 1
    }

    const match = findDurableMatch(record, existing)
    const entry: MergePlanEntry = {
      source: record.source,
      incomingXref: record.xref,
      newInternalId: newId,
      status: match === null ? 'NEW' : 'MATCH_CANDIDATE',
      extensionPayloads: Array.isArray(record.unknownTags) ? [...record.unknownTags] : [],
    }
    if (match !== null) {
      entry.matchType = match.matchType
      entry.matchedExistingId = match.existingId
    }
    entries.push(entry)
  }

  return { entries, xrefMap, skipped }
}

/** Identitas durable hasil ekstraksi baris record GEDCOM mentah. */
export interface DurableIdentity {
  uid?: string
  exids: IncomingExid[]
  refn?: string
}

/**
 * Ekstraktor pure jalur aditif (v373 AC3): membaca UID, EXID beserta
 * TYPE subordinatnya, dan REFN dari baris record GEDCOM level 1.
 * Tidak mengubah parser existing, tidak pernah melempar, input rusak
 * menghasilkan identitas kosong. EXID tanpa TYPE tetap terekstrak
 * dengan type undefined, konsisten dengan fakta bahwa hanya EXID
 * bertipe yang dipakai pencocokan otomatis.
 */
export function extractDurableIdentity(recordLines: unknown): DurableIdentity {
  const identity: DurableIdentity = { exids: [] }
  if (!Array.isArray(recordLines)) {
    return identity
  }
  for (const raw of recordLines) {
    if (typeof raw !== 'string') {
      continue
    }
    const tokens = raw.trim().split(/\s+/)
    if (tokens.length < 2) {
      continue
    }
    const level = Number(tokens[0])
    if (!Number.isInteger(level)) {
      continue
    }
    const tag = tokens[1]
    const payload = tokens.slice(2).join(' ').trim()
    if (level === 1 && tag === 'UID' && payload !== '') {
      identity.uid = payload
    } else if (level === 1 && tag === 'REFN' && payload !== '') {
      identity.refn = payload
    } else if (level === 1 && tag === 'EXID') {
      if (payload !== '') {
        identity.exids.push({ value: payload, type: undefined })
      }
    } else if (level === 2 && tag === 'TYPE' && payload !== '') {
      // TYPE subordinate GEDCOM 7 selalu muncul setelah baris EXID:
      // terapkan ke EXID terakhir yang belum bertipe, tanpa state
      // pending sehingga tidak mungkin bocor ke EXID berikutnya.
      const last = identity.exids[identity.exids.length - 1]
      if (last !== undefined && last.type === undefined) {
        last.type = payload
      }
    }
  }
  return identity
}
