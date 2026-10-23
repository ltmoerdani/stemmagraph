/**
 * Import merge statistics (v375): modul PURE untuk ringkasan pasca
 * import merge, lanjutan rantai import GAP #2, pilar statistik
 * keluarga VISION-stemmagraph. Pola pelaporan ditiru importer
 * Gramps: laporan pasca import per format, rujukan pola bukan
 * salinan kode. Sumber bentuk input: types nyata
 * src/lib/gedcom/importMergePlan.ts (MergePlanEntry status
 * NEW/MATCH_CANDIDATE/SKIPPED, matchType EXID/UID/REFN, xrefMap) dan
 * src/lib/gedcom/applyImportPlan.ts (ImportApplyReport:
 * createdMembers, duplicateXrefs, failedMembers, createdRelations,
 * skippedRelations ber-reason, failedRelations, memberWarnings).
 * Rujukan pola parser strict: preferred-spouse-summary.ts dan
 * divorce-rate-by-marriage-cohort.ts. Rujukan pola, bukan salinan
 * kode. Tanpa import server/, tanpa prisma, tanpa fetch, tanpa Date
 * sistem, tanpa I/O: murni transformasi array menjadi angka.
 *
 * Kontrak: computeImportMergeStatistics(payload) menerima objek
 * { plan, report, treeBefore }.
 *   plan.entries: array { source: 'INDI'|'FAM', status:
 *     'NEW'|'MATCH_CANDIDATE'|'SKIPPED', matchType?:
 *     'EXID'|'UID'|'REFN' }.
 *   plan.skipped: array { source: 'INDI'|'FAM', reason: string }
 *     (reason = skipReason entri skipped v373).
 *   plan.xrefMap: Record<string, string> hasil remap v373.
 *   report.createdMembers: array { xref?: string }.
 *   report.duplicateXrefs: array (string | undefined).
 *   report.failedMembers: array { xref?: string, error: string }.
 *   report.createdRelations: number non-negatif integer.
 *   report.skippedRelations: array { reason: string }.
 *   report.failedRelations: array { error: string }.
 *   report.memberWarnings: array { warning: string }.
 *   treeBefore: { persons: number, families: number }.
 *
 * Aturan angka:
 *   1. Distinct counting: duplicatesDetected = jumlah xref DISTINCT
 *      di duplicateXrefs (trim, skip undefined, dedup, acuan kasus 8
 *      v372). xrefsRemapped = jumlah kunci xrefMap.
 *   2. Invariant wajib: personsIncoming = personsNew +
 *      matchCandidates.total + skippedPersons; familiesIncoming
 *      mirror sama. Incoming = entries plus skipped per source.
 *   3. treeAfter = treeBefore + New per kategori. MATCH_CANDIDATE
 *      tidak menambah tree: kandidat bukan merge, keputusan milik
 *      pemanggil. delta = New.
 *   4. byReason, byWarning, dan breakdown matchType: kunci string
 *      terurut ASC (deterministik), kunci breakdown matchType
 *      selalu lengkap walau nol, tanpa entri = objek kosong.
 *   5. Semua angka non-negatif integer.
 *
 * Parsing strict ber-index pola v370/v373/v374 (prefiks
 * import-merge-statistics): payload, plan, report, atau treeBefore
 * bukan objek; tujuh array di plan/report bukan array; entri bukan
 * objek atau source atau status invalid; MATCH_CANDIDATE tanpa
 * matchType; xrefMap bukan objek string ke string; createdRelations,
 * treeBefore.persons, atau treeBefore.families negatif atau
 * non-integer atau hilang; reason, warning, atau error bukan string
 * DILEMPAR Error ber-index, bukan difilter diam-diam. Input kosong
 * (array kosong, xrefMap kosong, treeBefore 0/0) VALID: output nol,
 * treeAfter sama dengan treeBefore, delta 0.
 *
 * Deterministik: agregasi penghitung murni, kunci terurut ASC,
 * hasil identik untuk input identik. Nihil randomness, nihil jam
 * sistem, nihil I/O di jalur data.
 */

export type ImportStatsSource = 'INDI' | 'FAM'
export type ImportStatsStatus = 'NEW' | 'MATCH_CANDIDATE' | 'SKIPPED'
export type ImportStatsMatchType = 'EXID' | 'UID' | 'REFN'

export interface ImportStatsPlanEntry {
  source: ImportStatsSource
  status: ImportStatsStatus
  matchType?: ImportStatsMatchType
}

export interface ImportStatsSkippedEntry {
  source: ImportStatsSource
  reason: string
}

export interface ImportStatsPlan {
  entries: ImportStatsPlanEntry[]
  skipped: ImportStatsSkippedEntry[]
  xrefMap: Record<string, string>
}

export interface ImportStatsReport {
  createdMembers: { xref?: string }[]
  duplicateXrefs: (string | undefined)[]
  failedMembers: { xref?: string; error: string }[]
  createdRelations: number
  skippedRelations: { reason: string }[]
  failedRelations: { error: string }[]
  memberWarnings: { warning: string }[]
}

export interface ImportStatsTreeShape {
  persons: number
  families: number
}

export interface ImportMergeStatisticsPayload {
  plan: ImportStatsPlan
  report: ImportStatsReport
  treeBefore: ImportStatsTreeShape
}

export interface ImportMergeStatisticsResult {
  personsIncoming: number
  familiesIncoming: number
  personsNew: number
  familiesNew: number
  matchCandidates: {
    total: number
    byEXID: number
    byUID: number
    byREFN: number
  }
  skippedInput: {
    total: number
    byReason: Record<string, number>
  }
  xrefsRemapped: number
  duplicatesDetected: number
  membersFailed: number
  relationsCreated: number
  relationsSkipped: {
    total: number
    byReason: Record<string, number>
  }
  relationsFailed: number
  memberWarnings: {
    total: number
    byWarning: Record<string, number>
  }
  treeBefore: ImportStatsTreeShape
  treeAfter: ImportStatsTreeShape
  delta: ImportStatsTreeShape
}

const ERROR_PREFIX = 'import-merge-statistics'

const SOURCES: readonly ImportStatsSource[] = ['INDI', 'FAM']
const STATUSES: readonly ImportStatsStatus[] = ['NEW', 'MATCH_CANDIDATE', 'SKIPPED']
const MATCH_TYPES: readonly ImportStatsMatchType[] = ['EXID', 'UID', 'REFN']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Angka non-negatif integer strict; hilang, pecahan, atau negatif ditolak. */
function parseCount(raw: unknown, path: string): number {
  if (raw === undefined) {
    throw new Error(`${ERROR_PREFIX}: ${path} hilang`)
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    throw new Error(`${ERROR_PREFIX}: ${path} harus integer non-negatif`)
  }
  return raw
}

function parseSource(raw: unknown, path: string): ImportStatsSource {
  if (typeof raw !== 'string' || !SOURCES.includes(raw as ImportStatsSource)) {
    throw new Error(`${ERROR_PREFIX}: ${path} source harus INDI atau FAM`)
  }
  return raw as ImportStatsSource
}

function parseStatus(raw: unknown, path: string): ImportStatsStatus {
  if (typeof raw !== 'string' || !STATUSES.includes(raw as ImportStatsStatus)) {
    throw new Error(
      `${ERROR_PREFIX}: ${path} status harus NEW, MATCH_CANDIDATE, atau SKIPPED`,
    )
  }
  return raw as ImportStatsStatus
}

function parseMatchType(
  raw: unknown,
  path: string,
): ImportStatsMatchType | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !MATCH_TYPES.includes(raw as ImportStatsMatchType)) {
    throw new Error(`${ERROR_PREFIX}: ${path} matchType harus EXID, UID, atau REFN`)
  }
  return raw as ImportStatsMatchType
}

/**
 * Penghitung frekuensi dengan kunci terurut ASC. Kunci selalu string
 * non-kosong: nilai kosong ditolak parser strict sebelum masuk sini.
 */
function countByKey(items: string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const key of items) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const sorted: Record<string, number> = {}
  for (const key of [...counts.keys()].sort()) {
    sorted[key] = counts.get(key)
  }
  return sorted
}

export function computeImportMergeStatistics(
  payload: unknown,
): ImportMergeStatisticsResult {
  if (!isPlainObject(payload)) {
    throw new Error(`${ERROR_PREFIX}: payload harus objek`)
  }
  if (!isPlainObject(payload.plan)) {
    throw new Error(`${ERROR_PREFIX}: plan harus objek`)
  }
  if (!isPlainObject(payload.report)) {
    throw new Error(`${ERROR_PREFIX}: report harus objek`)
  }
  if (!isPlainObject(payload.treeBefore)) {
    throw new Error(`${ERROR_PREFIX}: treeBefore harus objek`)
  }

  const plan = payload.plan
  const report = payload.report
  const treeBefore: ImportStatsTreeShape = {
    persons: parseCount(payload.treeBefore.persons, 'treeBefore.persons'),
    families: parseCount(payload.treeBefore.families, 'treeBefore.families'),
  }

  if (!Array.isArray(plan.entries)) {
    throw new Error(`${ERROR_PREFIX}: plan.entries harus array`)
  }
  if (!Array.isArray(plan.skipped)) {
    throw new Error(`${ERROR_PREFIX}: plan.skipped harus array`)
  }
  if (!isPlainObject(plan.xrefMap)) {
    throw new Error(`${ERROR_PREFIX}: plan.xrefMap harus objek string ke string`)
  }
  for (const [key, value] of Object.entries(plan.xrefMap)) {
    if (typeof value !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: plan.xrefMap kunci ${key} nilai bukan string`,
      )
    }
  }

  if (!Array.isArray(report.createdMembers)) {
    throw new Error(`${ERROR_PREFIX}: report.createdMembers harus array`)
  }
  if (!Array.isArray(report.duplicateXrefs)) {
    throw new Error(`${ERROR_PREFIX}: report.duplicateXrefs harus array`)
  }
  if (!Array.isArray(report.failedMembers)) {
    throw new Error(`${ERROR_PREFIX}: report.failedMembers harus array`)
  }
  if (!Array.isArray(report.skippedRelations)) {
    throw new Error(`${ERROR_PREFIX}: report.skippedRelations harus array`)
  }
  if (!Array.isArray(report.failedRelations)) {
    throw new Error(`${ERROR_PREFIX}: report.failedRelations harus array`)
  }
  if (!Array.isArray(report.memberWarnings)) {
    throw new Error(`${ERROR_PREFIX}: report.memberWarnings harus array`)
  }
  const createdRelations = parseCount(report.createdRelations, 'report.createdRelations')

  // Fase plan: entri dan skipped divalidasi strict, lalu diagregasi
  // per source dan matchType sesuai kontrak invariant.
  let personsIncoming = 0
  let familiesIncoming = 0
  let personsNew = 0
  let familiesNew = 0
  let matchTotal = 0
  const matchCounts = { EXID: 0, UID: 0, REFN: 0 }
  const skipReasons: string[] = []

  plan.entries.forEach((entry, index) => {
    const path = `plan.entries index ${index}`
    if (!isPlainObject(entry)) {
      throw new Error(`${ERROR_PREFIX}: ${path} bukan objek`)
    }
    const source = parseSource(entry.source, path)
    const status = parseStatus(entry.status, path)
    const matchType = parseMatchType(entry.matchType, path)
    if (source === 'INDI') personsIncoming += 1
    else familiesIncoming += 1
    if (status === 'NEW') {
      if (source === 'INDI') personsNew += 1
      else familiesNew += 1
    } else if (status === 'MATCH_CANDIDATE') {
      matchTotal += 1
      // matchType wajib ada pada kandidat: kandidat tanpa jalur
      // pencocokan tidak masuk akal untuk breakdown.
      if (matchType === undefined) {
        throw new Error(
          `${ERROR_PREFIX}: ${path} MATCH_CANDIDATE wajib punya matchType`,
        )
      }
      matchCounts[matchType] += 1
    }
  })

  plan.skipped.forEach((entry, index) => {
    const path = `plan.skipped index ${index}`
    if (!isPlainObject(entry)) {
      throw new Error(`${ERROR_PREFIX}: ${path} bukan objek`)
    }
    const source = parseSource(entry.source, path)
    if (source === 'INDI') personsIncoming += 1
    else familiesIncoming += 1
    const reason = entry.reason
    if (typeof reason !== 'string') {
      throw new Error(`${ERROR_PREFIX}: ${path} reason harus string`)
    }
    skipReasons.push(reason)
  })

  // Fase report: field yang masuk ringkasan divalidasi strict.
  report.createdMembers.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${ERROR_PREFIX}: report.createdMembers index ${index} bukan objek`,
      )
    }
  })
  report.failedMembers.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${ERROR_PREFIX}: report.failedMembers index ${index} bukan objek`,
      )
    }
    if (typeof entry.error !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: report.failedMembers index ${index} error harus string`,
      )
    }
  })
  report.skippedRelations.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${ERROR_PREFIX}: report.skippedRelations index ${index} bukan objek`,
      )
    }
    if (typeof entry.reason !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: report.skippedRelations index ${index} reason harus string`,
      )
    }
  })
  report.failedRelations.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${ERROR_PREFIX}: report.failedRelations index ${index} bukan objek`,
      )
    }
    if (typeof entry.error !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: report.failedRelations index ${index} error harus string`,
      )
    }
  })
  report.memberWarnings.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${ERROR_PREFIX}: report.memberWarnings index ${index} bukan objek`,
      )
    }
    if (typeof entry.warning !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: report.memberWarnings index ${index} warning harus string`,
      )
    }
  })

  // Distinct counting acuan kasus 8 v372: trim, skip undefined, dedup.
  const distinctDuplicates = new Set<string>()
  for (const raw of report.duplicateXrefs as unknown[]) {
    if (typeof raw !== 'string') {
      if (raw !== undefined) {
        throw new Error(
          `${ERROR_PREFIX}: report.duplicateXrefs harus berisi string atau undefined`,
        )
      }
      continue
    }
    const trimmed = raw.trim()
    if (trimmed !== '') distinctDuplicates.add(trimmed)
  }

  const treeAfter: ImportStatsTreeShape = {
    persons: treeBefore.persons + personsNew,
    families: treeBefore.families + familiesNew,
  }

  return {
    personsIncoming,
    familiesIncoming,
    personsNew,
    familiesNew,
    matchCandidates: {
      total: matchTotal,
      byEXID: matchCounts.EXID,
      byUID: matchCounts.UID,
      byREFN: matchCounts.REFN,
    },
    skippedInput: {
      total: plan.skipped.length,
      byReason: countByKey(skipReasons),
    },
    xrefsRemapped: Object.keys(plan.xrefMap).length,
    duplicatesDetected: distinctDuplicates.size,
    membersFailed: report.failedMembers.length,
    relationsCreated: createdRelations,
    relationsSkipped: {
      total: report.skippedRelations.length,
      byReason: countByKey(report.skippedRelations.map((entry) => entry.reason)),
    },
    relationsFailed: report.failedRelations.length,
    memberWarnings: {
      total: report.memberWarnings.length,
      byWarning: countByKey(report.memberWarnings.map((entry) => entry.warning)),
    },
    treeBefore,
    treeAfter,
    delta: {
      persons: personsNew,
      families: familiesNew,
    },
  }
}
