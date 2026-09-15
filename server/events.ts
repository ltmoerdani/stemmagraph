// Single write gate for the append-only event store (P2-2 AC-3).
//
// appendEvent below is the ONLY place in the codebase that inserts into
// the Event table: grep for "event.create" outside this file must return
// nothing. There is intentionally no update or delete helper, and no
// endpoint exposes either operation: the store is append-only. Payloads
// pass the pure validator in src/lib/events before they reach the store,
// so third-party contact data is refused at the gate.

import type { Event } from '../generated/prisma/client';
import { prisma } from './db';
import {
  isEventType,
  serializeEventPayload,
  validateEventPayload,
  type EventPayload,
  type EventType,
} from '../src/lib/events';

export async function appendEvent(
  type: EventType,
  actorUserId: string | null,
  familyTreeId: string | null,
  payload: EventPayload,
): Promise<Event> {
  if (!isEventType(type)) {
    throw new Error(`unknown event type: ${String(type)}`);
  }
  const validation = validateEventPayload(type, payload);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  return prisma.event.create({
    data: {
      type,
      actorUserId,
      familyTreeId,
      payloadJson: serializeEventPayload(payload),
    },
  });
}
