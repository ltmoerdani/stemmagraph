// Citation coverage module: percentage of individuals covered by a citation.
//
// DEFINITION: an individual is citation-covered when they own at least one
// LifeEvent whose citationId is non-null AND not '@VOID@'. A @VOID@ pointer
// (or empty payload from a third-party import) counts as NOT covered.
//
// SEMANTIC BASIS: webtrees Statistics.php, individual SOUR (source citation)
// links attached to event records, same semantics as GEDCOM SOUR pointers on
// INDI event records. The @VOID@ addendum covers placeholder citations that
// third-party imports produce with no real source payload.
//
// Percentage = 100 x covered / total individuals, rounded to 1 decimal via
// Math.round(x * 10) / 10 (pattern from v267, v268 modules).
//
// A citation on a partner event (partnerMemberId) does NOT count for the
// partner individual, only for the event owner (memberId).
//
// No threshold. Empty tree (total 0 individuals): returns null.
//
// Pure module: no server imports, no prisma, no fetch, no network.
// Deterministic: input order does not affect the result.

export interface CitationCoverageMember {
  id: string;
}

export interface CitationCoverageLifeEvent {
  memberId: string;
  citationId: string | null;
}

export function computeCitationCoverage(
  members: { id: string }[],
  events: { memberId: string; citationId: string | null }[]
): number | null {
  if (members.length === 0) {
    return null;
  }

  const coveredIds = new Set<string>();
  for (const ev of events) {
    if (ev.citationId !== null && ev.citationId !== '@VOID@') {
      coveredIds.add(ev.memberId);
    }
  }

  let covered = 0;
  for (const m of members) {
    if (coveredIds.has(m.id)) {
      covered += 1;
    }
  }

  const pct = (100 * covered) / members.length;
  return Math.round(pct * 10) / 10;
}
