// Kontrak endpoint batch ops outbox (slice 2A, interface-only).
// File ini HANYA mendefinisikan bentuk request/response dan konstanta error.
// Implementasi server sungguhan menyusul di goal terpisah.
import type { OutboxOpKind } from './outbox';

// Payload satu operasi anggota di dalam batch.
// kind mengikuti tipe operasi outbox existing (member.add, member.update,
// member.remove); data opsional untuk kebutuhan member.add/member.update.
export interface BatchOpPayload {
  kind: OutboxOpKind;
  memberId: string;
  data?: Record<string, unknown>;
}

// Body request POST batch: kumpulan ops dikirim sekaligus dalam satu request.
export interface BatchOpsRequestBody {
  ops: BatchOpPayload[];
}

// Respons sukses batch.
// replay bernilai true saat server menjawab ulang respons request asli untuk
// key sama yang sudah selesai (semantik idempotency key, draft-08 IETF).
// Klien memakai replay untuk tahu bahwa ini jawaban lama, bukan eksekusi baru.
export interface BatchOpsSuccessResponse {
  applied: number;
  replay: boolean;
}

// Bentuk body error mengikuti RFC 9457 application/problem+json.
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

// 400: header Idempotency-Key hilang atau kosong.
export const BATCH_ERR_MISSING_KEY = 400;

// 422: key dipakai ulang untuk payload berbeda.
// Server membandingkan fingerprint payload; key sama + payload beda = tolak.
export const BATCH_ERR_KEY_REUSE = 422;

// 409: masih ada request lain dengan key/konteks sama yang belum selesai
// (concurrent outstanding). Jawaban final, TIDAK di-retry oleh klien.
// Hanya kegagalan transport (exception jaringan) yang di-retry; 4xx/5xx
// adalah jawaban final dari server.
// Pemutus konflik akhir tetap di server: LWW existing + revision,
// mengikuti putTreeLww di idb.ts (LWW berbasis savedAt + slot backup).
export const BATCH_ERR_CONCURRENT = 409;

// Deskripsi kontrak endpoint batch ops.
export interface BatchOpsContract {
  path: string;
  method: 'POST';
  idempotencyHeader: 'Idempotency-Key';
}

// Kontrak tetap: POST /api/trees/:treeId/members/batch dengan header
// Idempotency-Key berisi UUID RFC 9562 per batch.
export const BATCH_OPS_CONTRACT: BatchOpsContract = {
  path: '/api/trees/:treeId/members/batch',
  method: 'POST',
  idempotencyHeader: 'Idempotency-Key',
};
