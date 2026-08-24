// Pure weekly-digest builder for P2-7 (ADR 0008).
//
// This module is intentionally free of I/O: no database, no HTTP, no
// React, no nodemailer. Raw rows go in, a render-ready digest comes out.
// The builder is the consent and privacy fence for the email surface:
//
//   - Only events created inside the window count (half-open ISO week).
//   - Only events whose actor is NOT the recipient count: the digest
//     reports what OTHERS did on the recipient's trees (self-actions are
//     noise the recipient already knows about).
//   - Only events on trees where the recipient holds a TreeMember row
//     (any role) count: no membership, no email. Account-wide events
//     (null familyTreeId) have no tree, so they never enter the digest.
//   - The payload carries counts, tree names, actor display names and
//     the ISO week label only. No email addresses, no phone numbers, no
//     invitation tokens, no payloadJson fragments: names come from the
//     caller's lookup rows, never from event payloads.
//
// An empty result is { empty: true }: the caller skips the send and
// advances no timestamp (the AC's honest empty state).

import { EVENT_TYPES, type EventType } from '../events';
import type { WeeklyWindow } from './window';

/** A stored event row reduced to what the digest filter needs. */
export interface DigestSourceEvent {
  readonly id: string;
  readonly type: EventType;
  /** Account that performed the action, null for system actions. */
  readonly actorUserId: string | null;
  /** Tree the fact is scoped to, null for installation-wide facts. */
  readonly familyTreeId: string | null;
  readonly createdAt: Date | string;
}

/** Display-name lookup row for an acting account. */
export interface DigestActorRef {
  readonly id: string;
  readonly name: string;
}

/** Name lookup row for a tree the recipient may be a member of. */
export interface DigestTreeRef {
  readonly id: string;
  readonly name: string;
}

/** The recipient, reduced to id and display name. */
export interface DigestRecipientRef {
  readonly id: string;
  readonly name: string;
}

export interface DigestBuildInput {
  readonly recipient: DigestRecipientRef;
  readonly events: readonly DigestSourceEvent[];
  /** Trees where the recipient holds a TreeMember row (any role). */
  readonly membershipTreeIds: readonly string[];
  readonly trees: readonly DigestTreeRef[];
  readonly actors: readonly DigestActorRef[];
  readonly window: WeeklyWindow;
}

/** One tree's slice of the digest: counts for all seven types plus names. */
export interface DigestTreeSection {
  readonly treeId: string;
  readonly treeName: string;
  /** All seven v1 event types, always present, zero when nothing happened. */
  readonly counts: Readonly<Record<EventType, number>>;
  /** Distinct display names of acting accounts, alphabetical. */
  readonly actorNames: readonly string[];
}

export type WeeklyDigestBuild =
  | { readonly empty: true }
  | {
      readonly empty: false;
      readonly subject: string;
      readonly body: string;
      readonly treeSections: readonly DigestTreeSection[];
      /** Distinct actor display names across the whole digest, alphabetical. */
      readonly actorNames: readonly string[];
    };

/** Label shown in the UI for an actor the lookup could not resolve. */
export const UNKNOWN_ACTOR_LABEL = 'someone';

function zeroCounts(): Record<EventType, number> {
  const counts = {} as Record<EventType, number>;
  for (const type of EVENT_TYPES) counts[type] = 0;
  return counts;
}

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True when the event belongs to the digest: window, foreign actor, member tree. */
function isDigestEvent(event: DigestSourceEvent, input: DigestBuildInput): boolean {
  const at = toTime(event.createdAt);
  if (Number.isNaN(at) || at < input.window.startAt.getTime() || at >= input.window.endAt.getTime()) {
    return false;
  }
  if (event.actorUserId === input.recipient.id) return false;
  if (event.familyTreeId === null) return false;
  return input.membershipTreeIds.includes(event.familyTreeId);
}

/**
 * Builds the weekly digest for one recipient. Pure: same input, same
 * output, no clock reads (the window arrives as an argument), no network.
 */
export function buildWeeklyDigest(input: DigestBuildInput): WeeklyDigestBuild {
  const treeNames = new Map(input.trees.map((tree) => [tree.id, tree.name] as const));
  const actorNames = new Map(input.actors.map((actor) => [actor.id, actor.name] as const));

  const included = input.events.filter((event) => isDigestEvent(event, input));
  if (included.length === 0) return { empty: true };

  const sectionsByTree = new Map<string, { counts: Record<EventType, number>; actors: Set<string> }>();
  const allActors = new Set<string>();
  for (const event of included) {
    const treeId = event.familyTreeId as string;
    let section = sectionsByTree.get(treeId);
    if (section === undefined) {
      section = { counts: zeroCounts(), actors: new Set<string>() };
      sectionsByTree.set(treeId, section);
    }
    section.counts[event.type] += 1;
    const name =
      event.actorUserId === null
        ? UNKNOWN_ACTOR_LABEL
        : (actorNames.get(event.actorUserId) ?? UNKNOWN_ACTOR_LABEL);
    section.actors.add(name);
    allActors.add(name);
  }

  const treeSections: DigestTreeSection[] = [...sectionsByTree.entries()]
    .map(([treeId, section]) => ({
      treeId,
      treeName: treeNames.get(treeId) ?? treeId,
      counts: section.counts,
      actorNames: [...section.actors].sort(),
    }))
    .sort((a, b) => (a.treeName < b.treeName ? -1 : a.treeName > b.treeName ? 1 : 0));

  const sortedActorNames = [...allActors].sort();
  const subject = digestSubject(input.window, input.recipient);
  const body = renderDigestBody({
    recipientName: input.recipient.name,
    window: input.window,
    treeSections,
  });
  return { empty: false, subject, body, treeSections, actorNames: sortedActorNames };
}

// ─── The single EN plaintext template (ADR 0008) ─────────
//
// One template, English, plain text: no HTML email in v1, no per-locale
// variants (the product copy is bilingual but email stays EN until a
// need is proven). Zero-count types render no line, so quiet trees stay
// short. The footer is mandatory: it states why the email arrived and
// how to switch it off, and it is the only place the opt-out promise
// lives.

function digestSubject(window: WeeklyWindow, recipient: DigestRecipientRef): string {
  const lastDay = new Date(window.endAt.getTime() - 86_400_000);
  return `Stemmagraph weekly digest ${isoDay(window.startAt)} to ${isoDay(lastDay)}: ${recipient.name}`;
}

interface RenderInput {
  readonly recipientName: string;
  readonly window: WeeklyWindow;
  readonly treeSections: readonly DigestTreeSection[];
}

export function renderDigestBody(input: RenderInput): string {
  const lastDay = new Date(input.window.endAt.getTime() - 86_400_000);
  const lines: string[] = [
    `Hi ${input.recipientName},`,
    '',
    `Here is what happened on your family trees between ${isoDay(input.window.startAt)} and ${isoDay(lastDay)} (UTC).`,
    '',
  ];
  for (const section of input.treeSections) {
    lines.push(`# ${section.treeName}`);
    for (const type of EVENT_TYPES) {
      const count = section.counts[type];
      if (count > 0) lines.push(`- ${type}: ${count}`);
    }
    lines.push(`- Activity by: ${section.actorNames.join(', ')}`);
    lines.push('');
  }
  lines.push(
    'You received this email because you switched on the weekly digest in your Stemmagraph account.',
    'To stop these emails, open Stemmagraph, go to the dashboard, find the weekly digest panel and switch it off.',
    '',
    'Stemmagraph',
  );
  return lines.join('\n');
}
