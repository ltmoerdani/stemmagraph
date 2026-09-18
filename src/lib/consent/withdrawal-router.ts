/**
 * Withdrawal router module for Stemmagraph (S-115-ii-a).
 * Framework-agnostic route registration: no express, no app.listen, no IO.
 * The host app supplies a WithdrawalRouter implementation and ledger deps.
 * Seluruh logika transisi didelegasikan ke modul pure withdrawal-tracking.
 */

import {
  extendWithdrawalWindow,
  mapWithdrawalError,
  recordWithdrawalRefusal,
  recordWithdrawalRequest,
  resolveWithdrawal,
  withdrawalStateFromEvents,
  type WithdrawalEvent,
  type WithdrawalState,
} from './withdrawal-tracking';
import { NotFoundError } from '../adapters/types';

/** Handler context: member scope, acting user, and raw request body. */
export interface WithdrawalRouteContext {
  memberId: string;
  userId: string;
  body: unknown;
}

export type WithdrawalRouteHandler = (ctx: WithdrawalRouteContext) => Promise<WithdrawalRouteResult>;

/** Result variants handed back to the host framework. */
export type WithdrawalRouteResult =
  | { status: 404; code: 'not_found'; message: string }
  | { status: 403; code: 'forbidden'; message: string }
  | { status: 400; code: 'invalid_body'; message: string }
  | {
      status: 409;
      code: 'WITHDRAWAL_INVALID_TRANSITION' | 'WITHDRAWAL_CONFLICT';
      message: string;
    }
  | { status: 200; code: 'get'; payload: WithdrawalState }
  | { status: 200 | 201; code: 'write'; payload: WithdrawalState }
  | { status: 500; code: 'internal'; message: string };

/** Minimal router contract the host framework must satisfy. */
export interface WithdrawalRouter {
  get(path: string, handler: WithdrawalRouteHandler): unknown;
  post(path: string, handler: WithdrawalRouteHandler): unknown;
  delete(path: string, handler: WithdrawalRouteHandler): unknown;
}

/** Ledger access the routes rely on; implemented by the host app. */
export interface WithdrawalRouterDeps {
  listEvents: (memberId: string) => Promise<WithdrawalEvent[]>;
  appendEvent: (memberId: string, event: WithdrawalEvent) => Promise<void>;
  now: () => string;
}

const WITHDRAWAL_PATH = '/api/v1/members/:memberId/withdrawal';

type ParsedAction =
  | { kind: 'request' }
  | { kind: 'extend'; reason: string }
  | { kind: 'refuse'; reason: string; complaintInfo: string }
  | { kind: 'resolve' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Parse the raw body into a typed action. Returns null when the body
 * cannot be interpreted, which maps to 400 invalid_body.
 */
export function parseWithdrawalAction(body: unknown): ParsedAction | null {
  if (body === undefined || body === null) {
    return { kind: 'request' };
  }
  if (!isRecord(body)) {
    return null;
  }
  const action = body.action === undefined ? 'request' : body.action;
  if (action === 'request') {
    return { kind: 'request' };
  }
  if (action === 'extend') {
    if (!nonEmptyString(body.reason)) {
      return null;
    }
    return { kind: 'extend', reason: body.reason };
  }
  if (action === 'refuse') {
    if (!nonEmptyString(body.reason) || !nonEmptyString(body.complaintInfo)) {
      return null;
    }
    return { kind: 'refuse', reason: body.reason, complaintInfo: body.complaintInfo };
  }
  if (action === 'resolve') {
    return { kind: 'resolve' };
  }
  return null;
}

function notFound(message: string): WithdrawalRouteResult {
  return { status: 404, code: 'not_found', message };
}

function invalidBody(message: string): WithdrawalRouteResult {
  return { status: 400, code: 'invalid_body', message };
}

function invalidTransition(message: string): WithdrawalRouteResult {
  return { status: 409, code: 'WITHDRAWAL_INVALID_TRANSITION', message };
}

function toConflict(message: string): WithdrawalRouteResult {
  return { status: 409, code: 'WITHDRAWAL_CONFLICT', message };
}

/** Map thrown errors through mapWithdrawalError onto route results. */
function mapFailure(err: unknown): WithdrawalRouteResult {
  const code =
    typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : 'internal_error';
  const message = err instanceof Error ? err.message : `unexpected error: ${String(err)}`;
  const mapped = mapWithdrawalError(code);
  if (mapped.status === 409) {
    return toConflict(message);
  }
  if (mapped.status === 404) {
    return notFound(message);
  }
  if (mapped.status === 400) {
    return invalidBody(message);
  }
  return { status: 500, code: 'internal', message };
}

async function replay(deps: WithdrawalRouterDeps, memberId: string): Promise<WithdrawalState> {
  const events = await deps.listEvents(memberId);
  return withdrawalStateFromEvents(events);
}

async function runRequest(ctx: WithdrawalRouteContext, deps: WithdrawalRouterDeps): Promise<WithdrawalRouteResult> {
  const before = await replay(deps, ctx.memberId);
  if (before.stage === 'pending' || before.stage === 'refused') {
    return invalidTransition(`penarikan consent sudah berjalan (stage: ${before.stage})`);
  }
  await deps.appendEvent(ctx.memberId, recordWithdrawalRequest(deps.now()));
  const after = await replay(deps, ctx.memberId);
  return { status: 201, code: 'write', payload: after };
}

async function runExtend(
  ctx: WithdrawalRouteContext,
  reason: string,
  deps: WithdrawalRouterDeps,
): Promise<WithdrawalRouteResult> {
  const before = await replay(deps, ctx.memberId);
  if (before.stage !== 'pending') {
    return invalidTransition(`extend hanya sah saat pending (stage: ${before.stage})`);
  }
  await deps.appendEvent(ctx.memberId, extendWithdrawalWindow(deps.now(), reason, before.dueAt ?? undefined));
  const after = await replay(deps, ctx.memberId);
  return { status: 200, code: 'write', payload: after };
}

async function runRefuse(
  ctx: WithdrawalRouteContext,
  reason: string,
  complaintInfo: string,
  deps: WithdrawalRouterDeps,
): Promise<WithdrawalRouteResult> {
  const before = await replay(deps, ctx.memberId);
  if (before.stage !== 'pending') {
    return invalidTransition(`refuse hanya sah saat pending (stage: ${before.stage})`);
  }
  await deps.appendEvent(ctx.memberId, recordWithdrawalRefusal(reason, complaintInfo));
  const after = await replay(deps, ctx.memberId);
  return { status: 200, code: 'write', payload: after };
}

async function runResolve(ctx: WithdrawalRouteContext, deps: WithdrawalRouterDeps): Promise<WithdrawalRouteResult> {
  const before = await replay(deps, ctx.memberId);
  if (before.stage === 'none') {
    return notFound('withdrawal request not found');
  }
  if (before.stage === 'resolved') {
    return toConflict('withdrawal sudah resolved');
  }
  await deps.appendEvent(ctx.memberId, resolveWithdrawal(deps.now()));
  const after = await replay(deps, ctx.memberId);
  return { status: 200, code: 'write', payload: after };
}

/**
 * Register the three withdrawal routes on an abstract router.
 * GET replays ledger state, POST dispatches on the parsed body action
 * (request default, extend, refuse, resolve), DELETE resolves an active
 * withdrawal the same way as POST resolve.
 */
export function registerWithdrawalRoutes(router: WithdrawalRouter, deps: WithdrawalRouterDeps): void {
  router.get(WITHDRAWAL_PATH, async (ctx) => {
    try {
      const state = await replay(deps, ctx.memberId);
      if (state.stage === 'none') {
        return notFound('withdrawal request not found');
      }
      return { status: 200, code: 'get', payload: state };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
  });

  router.post(WITHDRAWAL_PATH, async (ctx) => {
    try {
      const action = parseWithdrawalAction(ctx.body);
      if (action === null) {
        return invalidBody('body tidak valid untuk route withdrawal');
      }
      if (action.kind === 'request') {
        return await runRequest(ctx, deps);
      }
      if (action.kind === 'extend') {
        return await runExtend(ctx, action.reason, deps);
      }
      if (action.kind === 'refuse') {
        return await runRefuse(ctx, action.reason, action.complaintInfo, deps);
      }
      return await runResolve(ctx, deps);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
  });

  router.delete(WITHDRAWAL_PATH, async (ctx) => {
    try {
      return await runResolve(ctx, deps);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
  });
}
