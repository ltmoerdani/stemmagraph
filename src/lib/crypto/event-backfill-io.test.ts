// Test runBackfillIo dengan prisma mock tanpa DB nyata: event.findMany dan
// lifeEvent.findMany dibuat mengembalikan baris sintetis, $transaction
// menerima array update lalu sukses atau reject sesuai skenario. Envelope
// v1 dibuat nyata lewat encryptEventPayload supaya planBackfillBatch yang
// asli bisa mendekripsi dan menaikkan kelas ke v2.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runBackfillIo } from './event-backfill-io';
import { encryptEventPayload } from './event-payload-cipher';

// DEK sintetis 32 byte untuk resolveDek dan resolveTreeKey.
const dek = Buffer.alloc(32, 7);

// Payload legacy JSON yang valid, siap dienkripsi ulang ke v2.
const legacy = (memberId: string): string => JSON.stringify({ memberId });

// Envelope v1 nyata: plaintext JSON berisi memberId, dienkripsi dengan dek
// dan keyId yang sama seperti yang dibalas resolver di test.
const v1Nyata = (keyId: string, memberId: string): string =>
  encryptEventPayload(dek, keyId, { memberId });

// State mock prisma: antrian balasan findMany per delegate dan perilaku
// transaksi yang bisa diatur per test.
type MockState = {
  eventRows: unknown[][];
  lifeEventRows: unknown[][];
  txImpl?: (updates: unknown[], options: unknown) => Promise<unknown>;
};

function buatPrisma(state: MockState): unknown {
  const buatDelegate = (antrian: unknown[][], tag: string) => ({
    findMany: vi.fn(async () => {
      const next = antrian.shift();
      return next ?? [];
    }),
    update: vi.fn((args: unknown) => ({ tag, args })),
  });
  const eventDelegate = buatDelegate(state.eventRows, 'event');
  const lifeEventDelegate = buatDelegate(state.lifeEventRows, 'lifeEvent');
  return {
    event: eventDelegate,
    lifeEvent: lifeEventDelegate,
    $transaction: vi.fn(async (updates: unknown[], options: unknown) => {
      if (state.txImpl) return state.txImpl(updates, options);
      return null;
    }),
  };
}

// Resolver standar: keyId berformat k<n> tersedia, selain itu null.
const resolveDek = (keyId: string): Buffer | null =>
  /^k\d+$/.test(keyId) ? dek : null;
const resolveTreeKey = (): { dek: Buffer; keyId: string } | null => ({
  dek,
  keyId: 'k1',
});

// Bantuan ambil delegate dari mock prisma untuk inspeksi panggilan.
function deleg(
  prisma: unknown,
  name: string,
): { update: ReturnType<typeof vi.fn> } {
  return (prisma as Record<string, unknown>)[name] as never;
}

// Bantuan ambil mock $transaction untuk hitung panggilan.
function txMock(prisma: unknown): ReturnType<typeof vi.fn> {
  return (prisma as Record<string, unknown>).$transaction as ReturnType<
    typeof vi.fn
  >;
}

describe('runBackfillIo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('kasus 1: campuran 3 v1 + 2 legacy + 1 v2, encrypted 5 dan skipped 1', async () => {
    // Tiga baris v1 diletakkan di LifeEvent yang punya kolom memberId,
    // dua legacy dan satu v2 di Event yang ekstraksi memberId dari JSON.
    const lifeEventRows = [
      {
        id: 'l1',
        treeId: 't1',
        memberId: 'm1',
        payloadJson: v1Nyata('k1', 'm1'),
      },
      {
        id: 'l2',
        treeId: 't1',
        memberId: 'm2',
        payloadJson: v1Nyata('k1', 'm2'),
      },
      {
        id: 'l3',
        treeId: 't1',
        memberId: 'm3',
        payloadJson: v1Nyata('k1', 'm3'),
      },
    ];
    const eventRows = [
      { id: 'e4', familyTreeId: 't1', payloadJson: legacy('m4') },
      { id: 'e5', familyTreeId: 't1', payloadJson: legacy('m5') },
      { id: 'e6', familyTreeId: 't1', payloadJson: 'v2:k1:aa:bb:cc' },
    ];
    const state: MockState = {
      eventRows: [eventRows],
      lifeEventRows: [lifeEventRows],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.totalRows).toBe(6);
    expect(summary.encrypted).toBe(5);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toBe(0);
    expect(summary.errorDetails).toEqual([]);
    // Update terkirim via $transaction: satu transaksi per chunk tabel.
    expect(txMock(prisma)).toHaveBeenCalledTimes(2);
    const txEvent = txMock(prisma).mock.calls[0][0] as unknown[];
    const txLife = txMock(prisma).mock.calls[1][0] as unknown[];
    expect(txEvent).toHaveLength(2);
    expect(txLife).toHaveLength(3);
    expect(deleg(prisma, 'event').update).toHaveBeenCalledTimes(2);
    expect(deleg(prisma, 'lifeEvent').update).toHaveBeenCalledTimes(3);
  });

  it('kasus 2: dek null menghasilkan dek_missing tanpa throw', async () => {
    const state: MockState = {
      eventRows: [
        [{ id: 'e1', familyTreeId: 't1', payloadJson: legacy('m1') }],
      ],
      lifeEventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek: () => null,
      resolveTreeKey,
    });
    expect(summary.errors).toBe(1);
    expect(summary.errorDetails).toEqual([
      { rowId: 'e1', reason: 'dek_missing' },
    ]);
  });

  it('kasus 3: legacy JSON rusak jadi legacy_invalid_json tanpa throw', async () => {
    const state: MockState = {
      eventRows: [
        [{ id: 'e1', familyTreeId: 't1', payloadJson: '{bukan json' }],
      ],
      lifeEventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.errorDetails).toEqual([
      { rowId: 'e1', reason: 'legacy_invalid_json' },
    ]);
  });

  it('kasus 4: envelope v1 rusak jadi envelope_corrupt tanpa throw', async () => {
    // Envelope dengan keyId benar tapi segmen cipher tidak valid sehingga
    // planBackfillBatch asli gagal dekripsi dan menandai envelope_corrupt.
    const state: MockState = {
      lifeEventRows: [
        [
          {
            id: 'l1',
            treeId: 't1',
            memberId: 'm1',
            payloadJson: 'v1:k1:IVYANGSALAH:TAGSALAH:CIPHERSALAH',
          },
        ],
      ],
      eventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.errorDetails).toEqual([
      { rowId: 'l1', reason: 'envelope_corrupt' },
    ]);
  });

  it('kasus 5: $transaction reject P2034, chunk itu error, chunk lain sukses', async () => {
    const eventRows = [
      { id: 'e1', familyTreeId: 't1', payloadJson: legacy('m1') },
      { id: 'e2', familyTreeId: 't1', payloadJson: legacy('m2') },
    ];
    const state: MockState = {
      eventRows: [eventRows],
      lifeEventRows: [
        [
          {
            id: 'l1',
            treeId: 't1',
            memberId: 'm3',
            payloadJson: legacy('m3'),
          },
        ],
      ],
      // Hanya transaksi chunk Event yang selalu konflik, chunk LifeEvent
      // sukses supaya terlihat run tetap lanjut saat satu chunk gagal.
      txImpl: async (updates) => {
        const first = (updates as Array<{ tag?: string }>)[0];
        if (first && first.tag === 'event') {
          throw Object.assign(new Error('conflict'), { code: 'P2034' });
        }
        return null;
      },
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      chunkSize: 200,
      resolveDek,
      resolveTreeKey,
    });
    // Event chunk gagal setelah 3 retry, dua rowId-nya masuk errorDetails,
    // LifeEvent chunk tetap sukses sehingga encrypted 1.
    expect(summary.encrypted).toBe(1);
    expect(summary.errors).toBe(2);
    expect(summary.errorDetails).toEqual([
      { rowId: 'e1', reason: 'tx_error_P2034' },
      { rowId: 'e2', reason: 'tx_error_P2034' },
    ]);
    // Event chunk retry 3x, LifeEvent chunk 1x, total 4 panggilan.
    expect(txMock(prisma)).toHaveBeenCalledTimes(4);
  });

  it('kasus 6: rerun idempoten, semua baris v2, encrypted 0', async () => {
    const state: MockState = {
      eventRows: [
        [
          { id: 'e1', familyTreeId: 't1', payloadJson: 'v2:k1:aa:bb:cc' },
          { id: 'e2', familyTreeId: 't1', payloadJson: 'v2:k1:aa:bb:cc' },
        ],
      ],
      lifeEventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.encrypted).toBe(0);
    expect(summary.skipped).toBe(2);
    expect(summary.errors).toBe(0);
    // Tanpa baris untuk diproses berarti tidak ada transaksi sama sekali.
    expect(txMock(prisma)).not.toHaveBeenCalled();
  });

  it('kasus 7: onProgress terpanggil tiap selesai chunk', async () => {
    // Dua chunk Event dengan chunkSize 2: total 4 baris legacy.
    const eventRows = [
      { id: 'e1', familyTreeId: 't1', payloadJson: legacy('m1') },
      { id: 'e2', familyTreeId: 't1', payloadJson: legacy('m2') },
      { id: 'e3', familyTreeId: 't1', payloadJson: legacy('m3') },
      { id: 'e4', familyTreeId: 't1', payloadJson: legacy('m4') },
    ];
    const state: MockState = {
      eventRows: [eventRows.slice(0, 2), eventRows.slice(2)],
      lifeEventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const onProgress = vi.fn();
    const summary = await runBackfillIo({
      prisma,
      chunkSize: 2,
      resolveDek,
      resolveTreeKey,
      onProgress,
    });
    // Dipanggil sekali per chunk yang berisi baris, salinan summary berjalan.
    expect(onProgress).toHaveBeenCalledTimes(2);
    const pertama = onProgress.mock.calls[0][0];
    const kedua = onProgress.mock.calls[1][0];
    expect(pertama.totalRows).toBe(2);
    expect(pertama.encrypted).toBe(2);
    expect(kedua.totalRows).toBe(4);
    expect(kedua.encrypted).toBe(4);
    expect(summary.encrypted).toBe(4);
    // Salinan tidak berubah saat summary utama maju.
    expect(pertama.totalRows).toBe(2);
  });

  it('kasus 8: Event tanpa memberId di payload jadi memberId_missing', async () => {
    const state: MockState = {
      eventRows: [
        [
          {
            id: 'e1',
            familyTreeId: 't1',
            payloadJson: JSON.stringify({ lain: 'nilai' }),
          },
        ],
      ],
      lifeEventRows: [[]],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.errorDetails).toEqual([
      { rowId: 'e1', reason: 'memberId_missing' },
    ]);
    expect(summary.errors).toBe(1);
  });

  it('kasus 9: treeId null jadi tree_missing untuk kedua tabel', async () => {
    const state: MockState = {
      eventRows: [
        [{ id: 'e1', familyTreeId: null, payloadJson: legacy('m1') }],
      ],
      lifeEventRows: [
        [
          {
            id: 'l1',
            treeId: null,
            memberId: 'm1',
            payloadJson: legacy('m1'),
          },
        ],
      ],
    };
    const prisma = buatPrisma(state);
    const summary = await runBackfillIo({
      prisma,
      resolveDek,
      resolveTreeKey,
    });
    expect(summary.errorDetails).toEqual([
      { rowId: 'e1', reason: 'tree_missing' },
      { rowId: 'l1', reason: 'tree_missing' },
    ]);
    expect(summary.errors).toBe(2);
  });
});
