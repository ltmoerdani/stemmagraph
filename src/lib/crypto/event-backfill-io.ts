// Eksekusi IO backfill payload event: jembatan antara perencana pure
// planBackfillBatch dan database via Prisma. Modul ini satu-satunya lapisan
// yang boleh menyentuh IO: query kandidat cursor pagination, transaksi per
// chunk, dan retry write conflict. Tanpa pencatatan payload maupun materi
// kunci di mana pun, hanya kode alasan pendek maksimal 120 karakter.
import { planBackfillBatch, type BackfillRow } from './event-backfill-plan';

// Ringkasan satu run backfill: total baris yang dievaluasi, jumlah yang
// berhasil dienkripsi, yang dilewati (v2 sehat atau tanpa op), jumlah error,
// dan detail error per baris berupa kode alasan pendek tanpa payload.
export type BackfillRunSummary = {
  totalRows: number;
  encrypted: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ rowId: string; reason: string }>;
};

// Opsi run: prisma client ditypekan longgar supaya mudah di-mock di test,
// chunkSize dengan default 200 dan clamp maksimum 999, resolver DEK per
// keyId untuk planBackfillBatch, resolver kunci tree untuk baris legacy
// tanpa keyId, dan callback progres yang dipanggil tiap chunk selesai.
export type BackfillIoOptions = {
  prisma: unknown;
  chunkSize?: number;
  resolveDek: (keyId: string) => Buffer | null;
  resolveTreeKey: (treeId: string) => { dek: Buffer; keyId: string } | null;
  onProgress?: (s: BackfillRunSummary) => void;
};

// Batas ukuran chunk sesuai spesifikasi: default 200, maksimum 999.
const DEFAULT_CHUNK_SIZE = 200;
const MAX_CHUNK_SIZE = 999;

// Opsi transaksi per chunk sesuai spesifikasi.
const TX_OPTIONS = { timeout: 30000, maxWait: 5000 };

// Retry manual untuk write conflict Prisma P2034, maksimum 3 percobaan
// dengan chunk yang sama sebelum chunk dinyatakan gagal.
const MAX_TX_RETRIES = 3;

// Kode error write conflict Prisma.
const PRISMA_P2034 = 'P2034';

// Normalisasi chunkSize: default 200 bila tidak valid, clamp ke maks 999,
// minimal 1 supaya pagination tidak macet.
function normalisasiChunkSize(chunkSize: number | undefined): number {
  if (
    typeof chunkSize !== 'number' ||
    !Number.isFinite(chunkSize) ||
    chunkSize < 1
  ) {
    return DEFAULT_CHUNK_SIZE;
  }
  return Math.min(Math.floor(chunkSize), MAX_CHUNK_SIZE);
}

// Baris Event kandidat hasil findMany, kolom select eksplisit.
type EventCandidate = {
  id: string;
  familyTreeId: string | null;
  payloadJson: string;
};

// Baris LifeEvent kandidat hasil findMany, punya kolom memberId.
type LifeEventCandidate = {
  id: string;
  treeId: string | null;
  memberId: string;
  payloadJson: string;
};

// Unit kerja internal per baris yang sudah lolos validasi awal.
type RowWork = {
  rowId: string;
  memberId: string;
  keyId: string;
  stored: string;
};

// Delegate prisma yang dipakai, ditypekan longgar agar mudah di-mock.
type AnyDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  update: (args: unknown) => unknown;
};

// Ambil delegate bernama dari objek prisma, error jelas bila tidak ada.
function ambilDelegate(prisma: unknown, name: string): AnyDelegate {
  const deleg = (prisma as Record<string, unknown>)[name];
  if (deleg === undefined || deleg === null) {
    throw new Error(`Prisma delegate ${name} tidak tersedia`);
  }
  return deleg as AnyDelegate;
}

// Hasil ekstraksi memberId dari payload: ok berisi memberId valid,
// gagal berisi alasan legacy_invalid_json atau memberId_missing.
type HasilMemberId =
  | { ok: true; memberId: string }
  | { ok: false; reason: 'legacy_invalid_json' | 'memberId_missing' };

// Ekstrak memberId dari payload JSON string. JSON rusak menjadi
// legacy_invalid_json, JSON valid tanpa memberId string non-empty menjadi
// memberId_missing. Tidak pernah throw.
function ekstrakMemberId(payloadJson: string): HasilMemberId {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson) as unknown;
  } catch {
    return { ok: false, reason: 'legacy_invalid_json' };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, reason: 'memberId_missing' };
  }
  const m = (parsed as Record<string, unknown>).memberId;
  if (typeof m !== 'string' || m === '') {
    return { ok: false, reason: 'memberId_missing' };
  }
  return { ok: true, memberId: m };
}

// Tentukan keyId dari stored: prefix v1 berarti segmen kedua envelope,
// legacy tanpa prefix berarti kunci aktif tree via resolveTreeKey.
// Balik null berarti baris tidak bisa diproses dengan alasan tree_missing.
function tentukanKeyId(
  stored: string,
  treeId: string,
  resolveTreeKey: BackfillIoOptions['resolveTreeKey'],
): string | null {
  if (stored.startsWith('v1:')) {
    return stored.split(':')[1] ?? null;
  }
  const treeKey = resolveTreeKey(treeId);
  if (treeKey === null) return null;
  return treeKey.keyId;
}

// Olah satu chunk kandidat yang sudah ternormalisasi: validasi treeId dan
// memberId, tentukan keyId, lalu kumpulkan unit kerja. Baris bermasalah
// dicatat ke errorDetails dan dilewati, tidak pernah melempar.
function kumpulkanWorks<T extends { id: string; payloadJson: string }>(
  rows: T[],
  ambilTreeId: (r: T) => string | null,
  ambilMemberId: (r: T) => HasilMemberId,
  resolveTreeKey: BackfillIoOptions['resolveTreeKey'],
  summary: BackfillRunSummary,
  catatError: (rowId: string, reason: string) => void,
): RowWork[] {
  const works: RowWork[] = [];
  for (const r of rows) {
    summary.totalRows += 1;
    // (a) treeId wajib ada, null atau kosong berarti tree_missing.
    const treeId = ambilTreeId(r);
    if (treeId === null || treeId === '') {
      catatError(r.id, 'tree_missing');
      continue;
    }
    // (e) v2 yang lolos query secara defensif dihitung skipped, tanpa op.
    if (r.payloadJson.startsWith('v2:')) {
      summary.skipped += 1;
      continue;
    }
    // (b) memberId wajib string non-empty, JSON rusak dilaporkan
    // dengan alasan legacy_invalid_json lewat hasil ekstraksi.
    const hasil = ambilMemberId(r);
    if (!hasil.ok) {
      catatError(r.id, hasil.reason);
      continue;
    }
    const memberId = hasil.memberId;
    // (c) keyId dari segmen stored v1 atau kunci aktif tree untuk legacy.
    const keyId = tentukanKeyId(r.payloadJson, treeId, resolveTreeKey);
    if (keyId === null || keyId === '') {
      catatError(r.id, 'tree_missing');
      continue;
    }
    works.push({ rowId: r.id, memberId, keyId, stored: r.payloadJson });
  }
  return works;
}

// Maksud utama: satu run backfill atas seluruh Event lalu seluruh LifeEvent
// dengan cursor pagination (orderBy id asc, cursor id chunk sebelumnya,
// bukan skip/offset), plan per chunk lewat planBackfillBatch, tulis balik
// lewat SATU $transaction array per chunk dengan retry P2034 maks 3x,
// dan ringkasan gabungan untuk kedua tabel.
export async function runBackfillIo(
  opts: BackfillIoOptions,
): Promise<BackfillRunSummary> {
  const chunkSize = normalisasiChunkSize(opts.chunkSize);
  const prisma = opts.prisma as Record<string, unknown>;
  const eventDelegate = ambilDelegate(prisma, 'event');
  const lifeEventDelegate = ambilDelegate(prisma, 'lifeEvent');
  const tx = prisma.$transaction as (
    arg: unknown,
    options?: unknown,
  ) => Promise<unknown>;

  const summary: BackfillRunSummary = {
    totalRows: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  // Catat error satu baris lalu naikkan penghitung. Reason pendek saja.
  const catatError = (rowId: string, reason: string): void => {
    summary.errorDetails.push({ rowId, reason });
    summary.errors += 1;
  };

  // Eksekusi satu chunk unit kerja: plan sekaligus seluruh chunk, susun
  // array update per delegate tabel asal, jalankan SATU transaksi dengan
  // retry P2034 maks 3x. Kegagalan final dicatat per rowId chunk lalu run
  // tetap lanjut, tidak gagal.
  const eksekusiChunk = async (
    deleg: AnyDelegate,
    works: RowWork[],
  ): Promise<void> => {
    if (works.length === 0) return;

    const rows: BackfillRow[] = works.map((w) => ({
      id: w.rowId,
      memberId: w.memberId,
      keyId: w.keyId,
      stored: w.stored,
    }));

    // Satu panggilan plan per chunk, hasil dipetakan 1:1 per baris.
    const ops = planBackfillBatch(rows, opts.resolveDek);

    const updates: unknown[] = [];
    const rowIdsUpdated: string[] = [];
    for (const op of ops) {
      if (op.kind === 'encrypt') {
        // Update delegate sesuai asal tabel baris, hanya kolom payloadJson.
        updates.push(
          deleg.update({
            where: { id: op.rowId },
            data: { payloadJson: op.nextStored },
          }),
        );
        rowIdsUpdated.push(op.rowId);
      } else {
        // Op error dari plan: dek_missing, legacy_invalid_json, atau
        // envelope_corrupt, dicatat tanpa menghentikan run.
        catatError(op.rowId, op.reason);
      }
    }

    if (updates.length === 0) return;

    // SATU transaksi per chunk, retry manual P2034 maksimal 3 percobaan.
    let attempt = 0;
    let committed = false;
    let lastReason = 'tx_failed';
    while (attempt < MAX_TX_RETRIES && !committed) {
      attempt += 1;
      try {
        await tx(updates, TX_OPTIONS);
        committed = true;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === PRISMA_P2034 && attempt < MAX_TX_RETRIES) {
          // Write conflict: ulangi transaksi sama dengan chunk yang sama.
          continue;
        }
        // Kegagalan final: reason pendek maks 120 char, tanpa payload
        // dan tanpa materi kunci, cukup kode error atau potongan pesan.
        const pesan =
          code !== undefined
            ? `tx_error_${code}`
            : ((err as { message?: string } | null)?.message ?? 'tx_failed');
        lastReason = pesan.slice(0, 120);
        break;
      }
    }

    if (committed) {
      summary.encrypted += rowIdsUpdated.length;
      return;
    }
    // Gagal transaksi: seluruh rowId yang punya update di chunk ini masuk
    // errorDetails, run tidak gagal, lanjut ke chunk berikutnya.
    for (const rowId of rowIdsUpdated) {
      catatError(rowId, lastReason);
    }
  };

  // Olah satu chunk Event lalu panggil onProgress dengan salinan summary.
  const prosesChunkEvent = async (rows: EventCandidate[]): Promise<void> => {
    const works = kumpulkanWorks(
      rows,
      (r) => r.familyTreeId,
      (r) => ekstrakMemberId(r.payloadJson),
      opts.resolveTreeKey,
      summary,
      catatError,
    );
    await eksekusiChunk(eventDelegate, works);
    opts.onProgress?.({ ...summary, errorDetails: [...summary.errorDetails] });
  };

  // Olah satu chunk LifeEvent: memberId sudah kolom tersendiri.
  const prosesChunkLifeEvent = async (
    rows: LifeEventCandidate[],
  ): Promise<void> => {
    const works = kumpulkanWorks(
      rows,
      (r) => r.treeId,
      (r) => {
        // LifeEvent memakai kolom memberId, tetap divalidasi non-empty.
        const m = r.memberId;
        if (m === null || m === '') {
          return { ok: false, reason: 'memberId_missing' as const };
        }
        return { ok: true, memberId: m };
      },
      opts.resolveTreeKey,
      summary,
      catatError,
    );
    await eksekusiChunk(lifeEventDelegate, works);
    opts.onProgress?.({ ...summary, errorDetails: [...summary.errorDetails] });
  };

  // Fase 1: semua chunk Event dengan cursor pagination berbasis id.
  let cursor: string | null = null;
  for (;;) {
    const batch = (await eventDelegate.findMany({
      where: { payloadJson: { not: { startsWith: 'v2:' } } },
      select: { id: true, familyTreeId: true, payloadJson: true },
      orderBy: { id: 'asc' },
      cursor: cursor ? { id: cursor } : undefined,
      take: chunkSize,
    })) as EventCandidate[];
    if (batch.length === 0) break;
    await prosesChunkEvent(batch);
    if (batch.length < chunkSize) break;
    cursor = batch[batch.length - 1].id;
  }

  // Fase 2: semua chunk LifeEvent pola sama, summary tetap satu gabungan.
  cursor = null;
  for (;;) {
    const batch = (await lifeEventDelegate.findMany({
      where: { payloadJson: { not: { startsWith: 'v2:' } } },
      select: { id: true, treeId: true, memberId: true, payloadJson: true },
      orderBy: { id: 'asc' },
      cursor: cursor ? { id: cursor } : undefined,
      take: chunkSize,
    })) as LifeEventCandidate[];
    if (batch.length === 0) break;
    await prosesChunkLifeEvent(batch);
    if (batch.length < chunkSize) break;
    cursor = batch[batch.length - 1].id;
  }

  return summary;
}
