// v112 slice 3 (bagian B): implementasi klien kontrak batch ops slice 2A.
// Sender mengirim kumpulan entry outbox sebagai satu POST batch ke endpoint
// BATCH_OPS_CONTRACT dengan header Idempotency-Key = batchKey.
//
// Aturan error mengikuti docs/offline/batch-ops-contract.md:
// - Respons 2xx: resolve, batch dianggap sukses.
// - Respons 400/422/409: throw Error berlabel kontrak, jawaban final dari
//   server, tidak boleh di-retry pemanggil.
// - Respons 5xx dan status lain: juga jawaban final, error diberi nama
//   ContractError (konstanta CONTRACT_ERROR_NAME dari flush.ts) sehingga
//   isContractError di flushOutbox tidak menganggapnya kegagalan transport.
// - Kegagalan transport (fetch reject): throw Error biasa, pemanggil boleh
//   retry di siklus berikutnya.
// Tidak ada retry internal di modul ini; retry adalah keputusan pemanggil
// (flushOutbox menghentikan flush pada throw pertama, siklus berikutnya
// mengulang dari outbox, semantik at-least-once tetap terjaga).
import { BATCH_OPS_CONTRACT } from './contract';
import type { BatchOpPayload, BatchOpsRequestBody } from './contract';
import type { OutboxEntry } from './outbox';
import { CONTRACT_ERROR_NAME } from './flush';
import { useFamilyStore } from '../../store/familyStore';

export interface BatchAdapterDeps {
  fetchImpl?: typeof fetch;
  origin?: string;
}

/** Label error kontrak: pemanggil dapat membedakan jawaban final server dari kegagalan transport. */
export const BATCH_CONTRACT_ERROR_LABEL = 'batch_ops_contract_error';

function resolveTreeId(): string {
  const treeId = useFamilyStore.getState().currentFamilyTreeId;
  if (!treeId) {
    throw new Error('batch sender: treeId aktif tidak tersedia');
  }
  return treeId;
}

export function createBatchSender(
  deps: BatchAdapterDeps = {},
): (entries: OutboxEntry[], batchKey: string) => Promise<void> {
  const fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis);
  const origin = deps.origin ?? '';

  return async (entries: OutboxEntry[], batchKey: string): Promise<void> => {
    const treeId = resolveTreeId();
    const path = BATCH_OPS_CONTRACT.path.replace(':treeId', encodeURIComponent(treeId));
    const url = `${origin}${path}`;

    const ops: BatchOpPayload[] = entries.map((entry) => ({
      kind: entry.kind,
      memberId: entry.memberId,
      ...(entry.data !== undefined ? { data: entry.data } : {}),
    }));
    const body: BatchOpsRequestBody = { ops };

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: BATCH_OPS_CONTRACT.method,
        headers: {
          [BATCH_OPS_CONTRACT.idempotencyHeader]: batchKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      // Kegagalan transport: pemanggil boleh retry di siklus berikutnya.
      throw new Error(`batch sender: kegagalan jaringan (${String(cause)})`);
    }

    if (response.ok) {
      return;
    }

    if (
      response.status === 400 ||
      response.status === 422 ||
      response.status === 409
    ) {
      // Jawaban final server (missing key, key reuse, concurrent outstanding).
      // Nama ContractError (konstanta flush.CONTRACT_ERROR_NAME) membuat
      // isContractError di flush.ts mengenali jawaban final sehingga tidak
      // di-retry sebagai kegagalan transport (AC2 GOAL v113).
      const error = new Error(`${BATCH_CONTRACT_ERROR_LABEL}: status ${response.status}`);
      error.name = CONTRACT_ERROR_NAME;
      throw error;
    }

    // 5xx dan status lain: juga jawaban final menurut kontrak, tidak di-retry internal.
    const error = new Error(`batch sender: respons gagal status ${response.status}`);
    error.name = CONTRACT_ERROR_NAME;
    throw error;
  };
}
