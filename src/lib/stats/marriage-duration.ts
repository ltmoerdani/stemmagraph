/**
 * Marriage duration extremes (v331 fase i): modul PURE untuk
 * distribusi durasi nikah plus pencarian pernikahan terpanjang dan
 * terpendek. Jangkar: magicsunday/webtrees-statistics src/Repository
 * /MarriageRepository.php durationDistribution() baris 210,
 * longestMarriageRecord() baris 229, shortestMarriageRecord()
 * baris 272, getMarriageDurationExtremes(topN=3) baris 319.
 *
 * DEFINISI: end = kandidat terkecil yang lebih besar dari
 * marriageDate (hari penuh) dari {divorceDate, spouse1DeathDate,
 * spouse2DeathDate}; tanpa kandidat, record digugur. endReason
 * divorce hanya bila divorceDate adalah kandidat terkecil persis.
 * durationYears integer anniversary penuh, durationDays selisih
 * hari UTC. marriageDate wajib ada; non-EXACT atau parsial dibuang
 * diam per record.
 *
 * Distribusi bucket 10 tahun label n-m (0-9 sampai 60+), bucket
 * kosong count 0 dipertahankan. Cap plausibility 90 tahun berlaku
 * di longest dan extremes, shortest memakai satuan hari.
 *
 * Parser strict pola v308 sampai v330: payload bukan array lempar
 * Error, elemen bukan objek lempar Error, familyId hilang atau
 * bukan string lempar Error, marriageDate hilang lempar Error.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random, em dash 0.
 */

export type MarriageEndReason = 'divorce' | 'death'

export interface MarriageDurationDate {
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface MarriageDurationFamily {
  familyId: string
  marriageDate: MarriageDurationDate | null
  divorceDate: MarriageDurationDate | null
  spouse1DeathDate: MarriageDurationDate | null
  spouse2DeathDate: MarriageDurationDate | null
}

export interface DurationBucket {
  band: string
  count: number
}

export interface MarriageDurationDistribution {
  buckets: DurationBucket[]
}

export interface MarriageDurationExtreme {
  familyId: string
  years: number
  days: number
  endReason: MarriageEndReason
}

export interface MarriageDurationExtremes {
  shortest: MarriageDurationExtreme[]
  longest: MarriageDurationExtreme[]
}

interface Ymd {
  y: number
  m: number
  d: number
}

function exactYmd(date: MarriageDurationDate | null): Ymd | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  if (monthStart < 1 || monthStart > 12) return null
  if (dayStart < 1 || dayStart > 31) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

function utcDaysBetween(from: Ymd, to: Ymd): number {
  const d1 = Date.UTC(from.y, from.m - 1, from.d)
  const d2 = Date.UTC(to.y, to.m - 1, to.d)
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

interface ProcessedMarriage {
  familyId: string
  years: number
  days: number
  endReason: MarriageEndReason
}

function processFamilies(families: MarriageDurationFamily[]): ProcessedMarriage[] {
  const results: ProcessedMarriage[] = []
  for (const fam of families) {
    if (!fam || typeof fam !== 'object') continue
    const mYmd = exactYmd(fam.marriageDate)
    if (mYmd === null) continue

    const candidates: { ymd: Ymd; reason: MarriageEndReason }[] = []
    const divYmd = exactYmd(fam.divorceDate)
    if (divYmd !== null && compareYmd(divYmd, mYmd) > 0) {
      candidates.push({ ymd: divYmd, reason: 'divorce' })
    }
    const s1Ymd = exactYmd(fam.spouse1DeathDate)
    if (s1Ymd !== null && compareYmd(s1Ymd, mYmd) > 0) {
      candidates.push({ ymd: s1Ymd, reason: 'death' })
    }
    const s2Ymd = exactYmd(fam.spouse2DeathDate)
    if (s2Ymd !== null && compareYmd(s2Ymd, mYmd) > 0) {
      candidates.push({ ymd: s2Ymd, reason: 'death' })
    }

    if (candidates.length === 0) continue

    candidates.sort((a, b) => {
      const c = compareYmd(a.ymd, b.ymd)
      if (c !== 0) return c
      if (a.reason === 'divorce' && b.reason !== 'divorce') return -1
      if (b.reason === 'divorce' && a.reason !== 'divorce') return 1
      return 0
    })

    const best = candidates[0]
    const years = fullYears(mYmd, best.ymd)
    const days = utcDaysBetween(mYmd, best.ymd)

    results.push({
      familyId: fam.familyId,
      years,
      days,
      endReason: best.reason,
    })
  }
  return results
}

const BUCKET_LABELS = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60+']

export function durationDistribution(
  families: MarriageDurationFamily[],
): MarriageDurationDistribution {
  const processed = processFamilies(families)
  const counts = new Array(7).fill(0)

  for (const item of processed) {
    const y = item.years
    if (y < 0) continue
    let idx = Math.floor(y / 10)
    if (idx > 6) idx = 6
    counts[idx] += 1
  }

  const buckets: DurationBucket[] = BUCKET_LABELS.map((band, idx) => ({
    band,
    count: counts[idx],
  }))

  return { buckets }
}

export function longestMarriageRecord(
  families: MarriageDurationFamily[],
): MarriageDurationExtreme | null {
  const processed = processFamilies(families)
  let best: ProcessedMarriage | null = null

  for (const item of processed) {
    if (item.years <= 0 || item.years > 90) continue
    if (best === null) {
      best = item
    } else {
      if (item.years > best.years) {
        best = item
      } else if (item.years === best.years) {
        if (item.familyId < best.familyId) {
          best = item
        }
      }
    }
  }

  if (best === null) return null
  return {
    familyId: best.familyId,
    years: best.years,
    days: best.days,
    endReason: best.endReason,
  }
}

export function shortestMarriageRecord(
  families: MarriageDurationFamily[],
): MarriageDurationExtreme | null {
  const processed = processFamilies(families)
  let best: ProcessedMarriage | null = null

  for (const item of processed) {
    if (item.days <= 0) continue
    if (best === null) {
      best = item
    } else {
      if (item.days < best.days) {
        best = item
      } else if (item.days === best.days) {
        if (item.familyId < best.familyId) {
          best = item
        }
      }
    }
  }

  if (best === null) return null
  return {
    familyId: best.familyId,
    years: best.years,
    days: best.days,
    endReason: best.endReason,
  }
}

export function getMarriageDurationExtremes(
  families: MarriageDurationFamily[],
  topN = 3,
): MarriageDurationExtremes {
  const processed = processFamilies(families)

  const validForLongest = processed.filter((item) => item.years > 0 && item.years <= 90)
  validForLongest.sort((a, b) => {
    if (b.years !== a.years) return b.years - a.years
    return a.familyId.localeCompare(b.familyId)
  })

  const longestSelected: ProcessedMarriage[] = []
  const usedIds = new Set<string>()
  for (const item of validForLongest) {
    if (longestSelected.length >= topN) break
    if (!usedIds.has(item.familyId)) {
      longestSelected.push(item)
      usedIds.add(item.familyId)
    }
  }

  const validForShortest = processed.filter((item) => item.days > 0)
  validForShortest.sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days
    return a.familyId.localeCompare(b.familyId)
  })

  const shortestSelected: ProcessedMarriage[] = []
  for (const item of validForShortest) {
    if (shortestSelected.length >= topN) break
    if (!usedIds.has(item.familyId)) {
      shortestSelected.push(item)
      usedIds.add(item.familyId)
    }
  }

  shortestSelected.sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days
    return a.familyId.localeCompare(b.familyId)
  })

  return {
    shortest: shortestSelected.map((i) => ({ familyId: i.familyId, years: i.years, days: i.days, endReason: i.endReason })),
    longest: longestSelected.map((i) => ({ familyId: i.familyId, years: i.years, days: i.days, endReason: i.endReason })),
  }
}

function assertDate(raw: unknown, index: number, field: string): MarriageDurationDate | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    throw new Error(`marriage-duration record[${index}].${field}: bukan objek atau null`)
  }
  const date = raw as Record<string, unknown>
  for (const part of ['dateKind', 'yearStart', 'monthStart', 'dayStart'] as const) {
    if (!(part in date)) {
      throw new Error(`marriage-duration record[${index}].${field}.${part}: hilang`)
    }
  }
  if (typeof date.dateKind !== 'string') {
    throw new Error(`marriage-duration record[${index}].${field}.dateKind: bukan string`)
  }
  for (const part of ['yearStart', 'monthStart', 'dayStart'] as const) {
    const value = date[part]
    if (value !== null && typeof value !== 'number') {
      throw new Error(`marriage-duration record[${index}].${field}.${part}: bukan number atau null`)
    }
  }
  return {
    dateKind: date.dateKind,
    yearStart: date.yearStart as number | null,
    monthStart: date.monthStart as number | null,
    dayStart: date.dayStart as number | null,
  }
}

function assertFamily(raw: unknown, index: number): MarriageDurationFamily {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`marriage-duration record[${index}]: hilang atau bukan objek`)
  }
  const record = raw as Record<string, unknown>
  if (typeof record.familyId !== 'string') {
    throw new Error(`marriage-duration record[${index}].familyId: hilang atau bukan string`)
  }
  if (!('marriageDate' in record) || record.marriageDate === null || record.marriageDate === undefined) {
    throw new Error(`marriage-duration record[${index}].marriageDate: hilang`)
  }
  return {
    familyId: record.familyId,
    marriageDate: assertDate(record.marriageDate, index, 'marriageDate'),
    divorceDate: assertDate(record.divorceDate, index, 'divorceDate'),
    spouse1DeathDate: assertDate(record.spouse1DeathDate, index, 'spouse1DeathDate'),
    spouse2DeathDate: assertDate(record.spouse2DeathDate, index, 'spouse2DeathDate'),
  }
}

export function parseMarriageDurationFamilies(payload: unknown): MarriageDurationFamily[] {
  let raw: unknown[]
  if (typeof payload === 'string') {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      throw new Error('marriage-duration: payload JSON tidak valid')
    }
    if (!Array.isArray(parsed)) {
      throw new Error('marriage-duration: payload JSON bukan array')
    }
    raw = parsed
  } else {
    if (!Array.isArray(payload)) {
      throw new Error('marriage-duration: payload bukan array')
    }
    raw = payload
  }
  return raw.map((item, index) => assertFamily(item, index))
}
