/**
 * v458 fase 1: kontrak pesan request/response worker layout.
 *
 * Semua tipe plain dan lolos structured clone. Payload input minimal
 * (id, name, generation, parentIds, spouseId, edges) sesuai Evidence 2
 * riset wake-324: node React Flow penuh membawa callbacks dan akan
 * memicu DataCloneError di postMessage.
 */
import type {
  TierPlanMemberInput,
  TierPlanResult,
} from './tierPlan';
import type {
  DagrePlanDirection,
  DagrePlanResult,
} from './dagrePlan';

export interface LayoutWorkerTierRequest {
  kind: 'tier';
  requestId: number;
  members: TierPlanMemberInput[];
}

export interface LayoutWorkerDagreRequest {
  kind: 'dagre';
  requestId: number;
  nodes: string[];
  edges: Array<{ source: string; target: string }>;
  direction: DagrePlanDirection;
}

export type LayoutWorkerRequest =
  | LayoutWorkerTierRequest
  | LayoutWorkerDagreRequest;

/** Omit distributif: mempertahankan union, bukan merge keys. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** Request tanpa requestId (diisi service saat kirim). */
export type LayoutWorkerRequestInput = DistributiveOmit<
  LayoutWorkerRequest,
  'requestId'
>;

export type LayoutWorkerResponse =
  | ({ kind: 'tier'; requestId: number } & TierPlanResult)
  | ({ kind: 'dagre'; requestId: number } & DagrePlanResult);
