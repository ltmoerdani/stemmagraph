/**
 * v458 fase 1: entry point Web Worker layout.
 *
 * Worker menerima request plain (layout-worker-protocol.ts), menjalankan
 * compute murni (tierPlan.ts / dagrePlan.ts), dan membalas hasil plain.
 * Tanpa akses DOM, tanpa callback, tanpa state antar pesan: compute
 * stateless, graph dagre dibuat segar per pesan (lihat dagrePlan.ts).
 *
 * Catatan tipe: tsconfig app memakai lib DOM, bukan WebWorker, jadi
 * konteks worker dideklarasikan minimal lokal (bukan reference lib
 * webworker) supaya tsc tidak bentrok self Window vs WorkerGlobalScope.
 */
import { computeDagrePlan } from './dagrePlan';
import { computeTierPlan } from './tierPlan';
import type {
  LayoutWorkerRequest,
  LayoutWorkerResponse,
} from './layout-worker-protocol';

/** Konteks minimal dedicated worker yang dipakai file ini. */
interface WorkerContext {
  onmessage: ((event: MessageEvent<LayoutWorkerRequest>) => void) | null;
  postMessage(message: LayoutWorkerResponse): void;
}

const ctx = self as unknown as WorkerContext;

ctx.onmessage = (event: MessageEvent<LayoutWorkerRequest>) => {
  const request = event.data;

  if (request.kind === 'tier') {
    const result = computeTierPlan(request.members);
    const response: LayoutWorkerResponse = {
      kind: 'tier',
      requestId: request.requestId,
      positions: result.positions,
      tiers: result.tiers,
      familyGroups: result.familyGroups,
    };
    ctx.postMessage(response);
    return;
  }

  if (request.kind === 'dagre') {
    const result = computeDagrePlan(
      request.nodes.map((id) => ({ id })),
      request.edges,
      request.direction
    );
    const response: LayoutWorkerResponse = {
      kind: 'dagre',
      requestId: request.requestId,
      positions: result.positions,
    };
    ctx.postMessage(response);
  }
};

export {};
