/**
 * Erasure router module for Stemmagraph (S-09b-vi-iii).
 * Framework-agnostic route registration: no express, no app.listen, no IO.
 * The host app supplies an ErasureRouter implementation and ledger deps.
 */

import {
  erasureGetResponse,
  erasureWriteOutcome,
  type ErasureRouteRow,
  type ErasureRouteGetResponse,
  type ErasureRouteWriteResponse,
  type ErasureRouteConflictResponse,
} from './erasure-routes';
import {
  parseErasureAction,
  planErasureRequest,
  decideErasureCancel,
} from './erasure-endpoints';
import {
  mapErasureError,
  type ErasureEventRow,
} from './erasure-wiring';
import { NotFoundError } from '../adapters/types';

/** Handler context: member scope, acting user, and raw request body. */
export interface ErasureRouteContext {
  memberId: string;
  userId: string;
  body: unknown;
}

export type ErasureRouteHandler = (ctx: ErasureRouteContext) => Promise<ErasureRouteResult>;

/** Result variants handed back to the host framework. */
export type ErasureRouteResult =
  | { status: 404; code: 'not_found'; message: string }
  | { status: 403; code: 'forbidden'; message: string }
  | { status: 400; code: 'invalid_body'; message: string }
  | {
      status: 409;
      code: 'CONSENT_INVALID_TRANSITION' | 'ERASURE_CONFLICT';
      message: string;
    }
  | { status: 200; code: 'get'; payload: ErasureRouteGetResponse }
  | { status: 200 | 201; code: 'write'; payload: ErasureRouteWriteResponse }
  | { status: 500; code: 'internal'; message: string };

/** Minimal router contract the host framework must satisfy. */
export interface ErasureRouter {
  get(path: string, handler: ErasureRouteHandler): unknown;
  post(path: string, handler: ErasureRouteHandler): unknown;
  delete(path: string, handler: ErasureRouteHandler): unknown;
}

/** Ledger access the routes rely on; implemented by the host app. */
export interface ErasureRouterDeps {
  listEvents: (memberId: string) => Promise<ErasureEventRow[]>;
  appendEvent: (row: ErasureEventRow) => Promise<void>;
}

const ERASURE_PATH = '/api/v1/members/:memberId/erasure';

function toRouteRows(events: readonly ErasureEventRow[]): ErasureRouteRow[] {
  return events.map((event) => ({
    type: event.type,
    payloadJson: event.payloadJson,
    createdAt: new Date(0),
  }));
}

function notFound(message: string): ErasureRouteResult {
  return { status: 404, code: 'not_found', message };
}

function mapFailure(err: unknown): ErasureRouteResult {
  const mapped = mapErasureError(err);
  if (mapped.status === 409) {
    return { status: 409, code: 'ERASURE_CONFLICT', message: mapped.message };
  }
  if (mapped.status === 400) {
    return { status: 400, code: 'invalid_body', message: mapped.message };
  }
  return { status: 500, code: 'internal', message: mapped.message };
}

function toConflict(response: ErasureRouteConflictResponse): ErasureRouteResult {
  return { status: 409, code: 'ERASURE_CONFLICT', message: response.message };
}

/** Cancel flow shared by POST (body action) and DELETE. */
async function runCancel(ctx: ErasureRouteContext, deps: ErasureRouterDeps): Promise<ErasureRouteResult> {
  const events = await deps.listEvents(ctx.memberId);
  const decision = decideErasureCancel(toRouteRows(events), new Date().toISOString());
  if (decision.kind === 'not-found') {
    return notFound('erasure request not found');
  }
  if (decision.kind === 'conflict') {
    return toConflict(decision.response);
  }
  await deps.appendEvent(decision.event);
  const after = await deps.listEvents(ctx.memberId);
  const outcome = erasureWriteOutcome(toRouteRows(after), 'cancel');
  return { status: outcome.status, code: 'write', payload: outcome };
}

/** Request flow: append the planned event, then replay for the outcome. */
async function runRequest(ctx: ErasureRouteContext, deps: ErasureRouterDeps): Promise<ErasureRouteResult> {
  const planned = planErasureRequest(ctx.memberId, new Date().toISOString());
  await deps.appendEvent(planned.event);
  const after = await deps.listEvents(ctx.memberId);
  const outcome = erasureWriteOutcome(toRouteRows(after), 'request');
  return { status: outcome.status, code: 'write', payload: outcome };
}

/**
 * Register the three erasure routes on an abstract router.
 * GET replays ledger state, POST defaults to request unless the body
 * parses as cancel, DELETE cancels an active request.
 */
export function registerErasureRoutes(router: ErasureRouter, deps: ErasureRouterDeps): void {
  router.get(ERASURE_PATH, async (ctx) => {
    let events: ErasureEventRow[];
    try {
      events = await deps.listEvents(ctx.memberId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
    const resp = erasureGetResponse(toRouteRows(events)) as
      | ErasureRouteGetResponse
      | ErasureRouteConflictResponse;
    if (resp.status === 200) {
      return { status: 200, code: 'get', payload: resp };
    }
    if (resp.status === 409) {
      return toConflict(resp);
    }
    return notFound('erasure request not found');
  });

  router.post(ERASURE_PATH, async (ctx) => {
    try {
      if (parseErasureAction(ctx.body) !== null) {
        return await runCancel(ctx, deps);
      }
      return await runRequest(ctx, deps);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
  });

  router.delete(ERASURE_PATH, async (ctx) => {
    try {
      return await runCancel(ctx, deps);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      return mapFailure(err);
    }
  });
}
