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

// v431 Consent Fase 2c: vocabulary for the consent audit trail. Kept next
// to the gate so the table contract and its only writer live in one file.
export const CONSENT_AUDIT_ACTIONS = ['grant', 'revoke', 'regrant', 'scope_change'] as const;
export type ConsentAuditAction = (typeof CONSENT_AUDIT_ACTIONS)[number];

export const CONSENT_AUDIT_SOURCES = ['ui', 'api'] as const;
export type ConsentAuditSource = (typeof CONSENT_AUDIT_SOURCES)[number];

/**
 * v431 AC2: versi kebijakan consent yang berlaku saat wiring ini lahir.
 * Nilai dinaikkan bila teks kebijakan consent produk berubah, supaya
 * tiap baris audit bisa dihubungkan dengan dokumen kebijakan yang
 * membentuk keputusan tersebut. Konstanta hidup di satu tempat dekat
 * gate agar vocab, validasi, dan versi kebijakan dibaca dari satu file.
 */
export const CONSENT_AUDIT_POLICY_VERSION = '1';

/** Input satu keputusan consent yang dicatat ke audit trail. */
export interface ConsentAuditEventInput {
  memberId: string;
  actorUserId: string;
  aksi: ConsentAuditAction;
  scope: string;
  policyVersion: string;
  sumber: ConsentAuditSource;
  /** True hanya untuk revoke tanpa efek ledger (no-op, ADR 0015). */
  noop?: boolean;
  /** Waktu keputusan; server memakai now() bila tidak diberikan. */
  at?: Date;
}

function isConsentAuditAction(value: string): value is ConsentAuditAction {
  return (CONSENT_AUDIT_ACTIONS as readonly string[]).includes(value);
}

function isConsentAuditSource(value: string): value is ConsentAuditSource {
  return (CONSENT_AUDIT_SOURCES as readonly string[]).includes(value);
}

/**
 * v431 Consent Fase 2c: single write gate untuk tabel ConsentAuditEvent
 * (pola persis appendEvent di atas). Ini satu-satunya insert ke tabel
 * tersebut: grep "consentAuditEvent.create" di luar file ini harus nihil.
 * Sengaja TANPA helper update atau delete dan TANPA endpoint yang
 * mengekspos keduanya: audit trail append-only, status efektif consent
 * direkonstruksi dari log saja (reconstructEffectiveConsent,
 * src/lib/consent/audit.ts). Kegagalan di sini jangan pernah membatalkan
 * operasi consent inti: pemanggil (endpoint consent) menangkap error dan
 * melanjutkan respons (fire-and-forget, pola safeEmitConsentEvent).
 */
export async function appendAuditEvent(input: ConsentAuditEventInput) {
  if (!input.memberId || input.memberId.trim().length === 0) {
    throw new Error('consent audit: memberId wajib diisi');
  }
  if (!input.actorUserId || input.actorUserId.trim().length === 0) {
    throw new Error('consent audit: actorUserId wajib diisi');
  }
  if (!isConsentAuditAction(input.aksi)) {
    throw new Error(`consent audit: aksi tidak dikenal: ${String(input.aksi)}`);
  }
  if (!input.scope || input.scope.trim().length === 0) {
    throw new Error('consent audit: scope wajib diisi');
  }
  if (!input.policyVersion || input.policyVersion.trim().length === 0) {
    throw new Error('consent audit: policyVersion wajib diisi');
  }
  if (!isConsentAuditSource(input.sumber)) {
    throw new Error(`consent audit: sumber tidak dikenal: ${String(input.sumber)}`);
  }
  return prisma.consentAuditEvent.create({
    data: {
      memberId: input.memberId,
      actorUserId: input.actorUserId,
      aksi: input.aksi,
      scope: input.scope,
      policyVersion: input.policyVersion,
      sumber: input.sumber,
      noop: input.noop ?? false,
      at: input.at ?? new Date(),
    },
  });
}

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
