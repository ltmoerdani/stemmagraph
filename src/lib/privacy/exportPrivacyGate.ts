// Export privacy gate for Stemmagraph (S-06 Privacy Filter Wave 1).
//
// Pure, deterministic, zero dependencies: no I/O, no clock, no store.
// This module is the single source of truth for the export redact
// decision. Both export paths (.ged via exportGedcom70 and GEDZIP via
// exportGedzip) consume it, and the export UI reads its report counts
// before any download starts.
//
// Policy (VISION T0e pillar 6, safe default):
// - Deceased members are exported in full.
// - Living members flagged 'shared' are exported in full.
// - Living members flagged 'private', or with no flag recorded yet
//   (NULL at the database level), are redacted in the clean share
//   export.
//
// The structural input type means adapter records satisfy it without
// any conversion; only the privacy-relevant fields are read.

/** Privacy-relevant member fields (structural: any record with these). */
export interface ExportPrivacyMember {
  isAlive: boolean
  deathDate?: string
  privacyStatus?: 'shared' | 'private'
}

/** Per-member export decision consumed by the GEDCOM mapper. */
export type ExportPrivacyDecision = 'full' | 'redact'

/** Aggregated counts for the pre-export UI report. */
export interface ExportPrivacyReport {
  total: number
  /** Living members exported without redaction ('shared'). */
  livingFull: number
  /** Living members whose data is redacted. */
  livingRedacted: number
  /** Deceased members (always exported in full). */
  deceased: number
}

function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * Living check for privacy purposes, deliberately conservative.
 *
 * A member counts as living when isAlive is true OR no death date is
 * recorded. Only a member recorded as not alive AND carrying a death
 * date counts as deceased. The direction is intentional: when the data
 * is incomplete the member is treated as living, which redacts rather
 * than leaks (safe default).
 */
export function isLiving(member: ExportPrivacyMember): boolean {
  return member.isAlive === true || isBlank(member.deathDate)
}

/**
 * Full-or-redact decision for one member:
 * - not living -> 'full' (deceased members are exported intact)
 * - living && 'shared' -> 'full' (explicit consent)
 * - living && 'private' or no flag -> 'redact' (safe default)
 *
 * Any other privacyStatus value is treated like 'private' so malformed
 * data can never widen what gets exported.
 */
export function evaluateMemberPrivacy(
  member: ExportPrivacyMember,
): ExportPrivacyDecision {
  if (!isLiving(member)) return 'full'
  if (member.privacyStatus === 'shared') return 'full'
  return 'redact'
}

/**
 * Counts the whole member list in one pass so the UI can show the
 * export summary before any download starts. livingFull plus
 * livingRedacted plus deceased always equals total. Redact decisions
 * are derived from evaluateMemberPrivacy so the report and the mapper
 * can never disagree.
 */
export function buildExportPrivacyReport(
  members: readonly ExportPrivacyMember[],
): ExportPrivacyReport {
  const report: ExportPrivacyReport = {
    total: members.length,
    livingFull: 0,
    livingRedacted: 0,
    deceased: 0,
  }
  for (const member of members) {
    if (!isLiving(member)) {
      report.deceased += 1
    } else if (evaluateMemberPrivacy(member) === 'full') {
      report.livingFull += 1
    } else {
      report.livingRedacted += 1
    }
  }
  return report
}
