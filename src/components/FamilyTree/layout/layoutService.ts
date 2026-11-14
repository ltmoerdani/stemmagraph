/**
 * v458 fase 1: client Web Worker layout, satu API async untuk pemanggil.
 *
 * Fitur (anchor riset wake-324 Evidence 1 dan 4):
 * - feature detection: typeof Worker belum ada, compute langsung main
 *   thread (MDN Using Web Workers).
 * - pola Vite resmi: new URL langsung di dalam new Worker, options
 *   statis, chunk worker terpisah di build produksi.
 * - fallback onerror: worker gagal load chunk atau crash, semua request
 *   pending beralih ke compute main-thread, flag workerFailed permanen
 *   supaya tidak retry terus pada worker yang rusak.
 * - timeout guard: balasan tidak datang dalam 15 detik, compute main
 *   thread untuk request itu, worker dianggap macet.
 * - lifecycle: dispose() menghentikan worker (terminate) dan menyelesaikan
 *   pending lewat jalur main-thread; idle timer menghentikan worker
 *   kosong agar tidak menggantung, request berikutnya membuat ulang.
 * - payload plain-object saja (layout-worker-protocol.ts) karena node
 *   React Flow membawa callbacks yang tidak bisa di-structured-clone.
 */
import { computeDagrePlan } from './dagrePlan';
import { computeTierPlan } from './tierPlan';
import type {
  DagrePlanDirection,
  DagrePlanResult,
} from './dagrePlan';
import type {
  TierPlanMemberInput,
  TierPlanResult,
} from './tierPlan';
import type {
  LayoutWorkerRequest,
  LayoutWorkerRequestInput,
  LayoutWorkerResponse,
} from './layout-worker-protocol';

const WORKER_TIMEOUT_MS = 15_000;
const IDLE_TERMINATE_MS = 30_000;

interface PendingEntry {
  resolve: (response: LayoutWorkerResponse) => void;
  timer: ReturnType<typeof setTimeout>;
  computeFallback: () => LayoutWorkerResponse;
  settled: boolean;
}

/**
 * Service layout async: pemanggil menunggu Promise hasil rencana layout;
 * pemilihan jalur worker vs main-thread terjadi di dalam kelas ini.
 */
class LayoutService {
  private worker: Worker | null = null;

  private pending = new Map<number, PendingEntry>();

  private nextRequestId = 1;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Worker terbukti rusak (onerror): jangan coba lagi sesi ini. */
  private workerFailed = false;

  /** Tercatat true setelah minimal satu balasan valid dari worker. */
  private workerResponded = false;

  private ensureWorker(): Worker | null {
    if (this.workerFailed) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      this.workerFailed = true;
      return null;
    }
    try {
      const worker = new Worker(
        new URL('./layout.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (event: MessageEvent<LayoutWorkerResponse>) => {
        this.handleResponse(event.data);
      };
      worker.onerror = () => {
        this.handleWorkerFailure();
      };
      this.worker = worker;
      return worker;
    } catch {
      this.workerFailed = true;
      return null;
    }
  }

  /** Worker gagal permanen: semua pending selesai via main-thread. */
  private handleWorkerFailure(): void {
    this.workerFailed = true;
    this.settleAllViaFallback();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private settleAllViaFallback(): void {
    this.pending.forEach((entry) => {
      if (entry.settled) return;
      entry.settled = true;
      clearTimeout(entry.timer);
      entry.resolve(entry.computeFallback());
    });
    this.pending.clear();
  }

  private handleResponse(response: LayoutWorkerResponse): void {
    this.workerResponded = true;
    const entry = this.pending.get(response.requestId);
    if (!entry || entry.settled) return;
    entry.settled = true;
    clearTimeout(entry.timer);
    this.pending.delete(response.requestId);
    entry.resolve(response);
  }

  private requestViaWorker(
    payload: LayoutWorkerRequestInput,
    computeFallback: () => LayoutWorkerResponse
  ): Promise<LayoutWorkerResponse> {
    return new Promise<LayoutWorkerResponse>((resolve) => {
      const requestId = this.nextRequestId;
      this.nextRequestId += 1;
      const worker = this.ensureWorker();
      if (!worker) {
        resolve(computeFallback());
        return;
      }

      const timer = setTimeout(() => {
        // Balasan tidak pernah datang: request ini selesai main-thread.
        // Worker macet tidak dimatikan di sini; onerror berikutnya yang
        // memutus permanen. Request berikutnya tetap dicoba via worker.
        const entry = this.pending.get(requestId);
        if (!entry || entry.settled) return;
        entry.settled = true;
        this.pending.delete(requestId);
        resolve(computeFallback());
      }, WORKER_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve,
        timer,
        computeFallback,
        settled: false,
      });

      const message = { ...payload, requestId } as LayoutWorkerRequest;
      worker.postMessage(message);
    });
  }

  private touchIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0 && this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    }, IDLE_TERMINATE_MS);
  }

  /** Tier layout (arah TB, jalur default initial load). */
  async computeTierLayout(members: TierPlanMemberInput[]): Promise<TierPlanResult> {
    this.touchIdleTimer();
    const computeFallback = (): LayoutWorkerResponse => {
      const result = computeTierPlan(members);
      return { kind: 'tier', requestId: -1, ...result };
    };
    const response = await this.requestViaWorker(
      { kind: 'tier', members },
      computeFallback
    );
    if (response.kind === 'tier') {
      return {
        positions: response.positions,
        tiers: response.tiers,
        familyGroups: response.familyGroups,
      };
    }
    return computeTierPlan(members);
  }

  /** Layout dagre (arah LR). */
  async computeDagreLayout(
    nodeIds: string[],
    edges: Array<{ source: string; target: string }>,
    direction: DagrePlanDirection
  ): Promise<DagrePlanResult> {
    this.touchIdleTimer();
    const computeFallback = (): LayoutWorkerResponse => {
      const result = computeDagrePlan(
        nodeIds.map((id) => ({ id })),
        edges,
        direction
      );
      return { kind: 'dagre', requestId: -1, positions: result.positions };
    };
    const response = await this.requestViaWorker(
      { kind: 'dagre', nodes: nodeIds, edges, direction },
      computeFallback
    );
    if (response.kind === 'dagre') {
      return { positions: response.positions };
    }
    return computeDagrePlan(
      nodeIds.map((id) => ({ id })),
      edges,
      direction
    );
  }

  /**
   * True bila minimal satu compute benar-benar dijawab worker (bukan
   * fallback main-thread). Dipakai host benchmark sebagai probe jalur.
   */
  get respondedViaWorker(): boolean {
    return this.workerResponded;
  }

  /** Unmount/idle: matikan worker, pending selesai via main-thread. */
  dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.settleAllViaFallback();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const layoutService = new LayoutService();
