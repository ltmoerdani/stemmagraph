/**
 * Modul pure alur consent withdrawal tracking (STG v115-i).
 * GDPR Art. 12(3) & Art. 17(3).
 * Tanpa import dari server, prisma, atau store.
 */

export type WithdrawalEventType = 'request' | 'extend' | 'refuse' | 'resolve';

export interface WithdrawalEvent {
  type: WithdrawalEventType;
  at: string; // ISO 8601
  dueAt?: string;
  reason?: string;
  complaintInfo?: string;
}

export interface WithdrawalState {
  stage: 'none' | 'pending' | 'refused' | 'resolved';
  requestedAt: string | null;
  dueAt: string | null;
  refusalReason: string | null;
  complaintInfo: string | null;
}

/** Tenggat pemenuhan penarikan consent: 30 hari (GDPR Art. 12(3)). */
export const WITHDRAWAL_DUE_DAYS = 30;

const DUE_MS = WITHDRAWAL_DUE_DAYS * 24 * 60 * 60 * 1000;

function requireIso(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} bukan timestamp ISO 8601 yang valid: ${String(value)}`);
  }
}

export function recordWithdrawalRequest(now: string): WithdrawalEvent {
  requireIso(now, 'now');
  const due = new Date(Date.parse(now) + DUE_MS).toISOString();
  return {
    type: 'request',
    at: now,
    dueAt: due,
  };
}

export function extendWithdrawalWindow(now: string, reason: string, currentDueAt?: string): WithdrawalEvent {
  requireIso(now, 'now');
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('Alasan perpanjangan wajib diisi');
  }
  const baseMs = currentDueAt && !Number.isNaN(Date.parse(currentDueAt)) ? Date.parse(currentDueAt) : Date.parse(now);
  const due = new Date(baseMs + DUE_MS).toISOString();
  return {
    type: 'extend',
    at: now,
    dueAt: due,
    reason,
  };
}

export function recordWithdrawalRefusal(reason: string, complaintInfo: string): WithdrawalEvent {
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('Alasan penolakan wajib diisi');
  }
  if (!complaintInfo || typeof complaintInfo !== 'string' || complaintInfo.trim() === '') {
    throw new Error('Informasi hak komplain wajib diisi (GDPR Art. 17(3))');
  }
  const now = new Date().toISOString();
  return {
    type: 'refuse',
    at: now,
    reason,
    complaintInfo,
  };
}

export function resolveWithdrawal(now: string): WithdrawalEvent {
  requireIso(now, 'now');
  return {
    type: 'resolve',
    at: now,
  };
}

export function withdrawalStateFromEvents(events: WithdrawalEvent[]): WithdrawalState {
  const state: WithdrawalState = {
    stage: 'none',
    requestedAt: null,
    dueAt: null,
    refusalReason: null,
    complaintInfo: null,
  };

  for (const ev of events) {
    if (ev.type === 'request') {
      state.stage = 'pending';
      state.requestedAt = ev.at;
      state.dueAt = ev.dueAt || null;
      state.refusalReason = null;
      state.complaintInfo = null;
    } else if (ev.type === 'extend') {
      if (state.stage === 'pending') {
        if (ev.dueAt) {
          state.dueAt = ev.dueAt;
        } else if (state.dueAt) {
          state.dueAt = new Date(Date.parse(state.dueAt) + DUE_MS).toISOString();
        } else {
          state.dueAt = new Date(Date.parse(ev.at) + DUE_MS).toISOString();
        }
      }
    } else if (ev.type === 'refuse') {
      if (state.stage === 'pending') {
        state.stage = 'refused';
        state.refusalReason = ev.reason || null;
        state.complaintInfo = ev.complaintInfo || null;
      }
    } else if (ev.type === 'resolve') {
      if (state.stage === 'pending' || state.stage === 'refused') {
        state.stage = 'resolved';
      }
    }
  }

  return state;
}

export function mapWithdrawalError(code: string): { status: number; code: string; title: string } {
  switch (code) {
    case 'invalid_state':
      return { status: 409, code: 'invalid_state', title: 'Conflict' };
    case 'not_found':
      return { status: 404, code: 'not_found', title: 'Not Found' };
    case 'invalid_request':
      return { status: 400, code: 'invalid_request', title: 'Bad Request' };
    default:
      return { status: 500, code: 'internal_error', title: 'Internal Server Error' };
  }
}
