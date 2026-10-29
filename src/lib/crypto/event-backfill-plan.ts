import {
  decryptEventPayload,
  encryptEventPayloadV2,
} from './event-payload-cipher';

// Perencana backfill payload event: modul PURE, tanpa fs, tanpa env, tanpa
// prisma, tanpa IO. Fungsi hanya menghitung daftar operasi, eksekusinya
// ada di lapisan lain. Tidak ada efek samping dan tidak ada pencatatan
// materi kunci di mana pun.

// Satu baris data event yang akan dievaluasi untuk backfill.
export type BackfillRow = {
  id: string;
  memberId: string;
  keyId: string;
  stored: string;
};

// Resolver DEK per keyId, null berarti kunci tidak tersedia saat ini.
export type DekResolver = (keyId: string) => Buffer | null;

// Operasi hasil perencanaan: encrypt untuk baris yang naik kelas ke v2,
// error untuk baris bermasalah. Baris v2 yang sehat tidak menghasilkan op.
export type BackfillOp =
  | {
      kind: 'encrypt';
      rowId: string;
      memberId: string;
      keyId: string;
      nextStored: string;
    }
  | {
      kind: 'error';
      rowId: string;
      reason: 'dek_missing' | 'legacy_invalid_json' | 'envelope_corrupt';
    };

// Susun rencana backfill untuk satu batch baris. Aturan per baris:
// - stored tanpa prefix v1:/v2: adalah legacy JSON, payload diparse lalu
//   dienkripsi ulang ke v2. JSON rusak menjadi error legacy_invalid_json.
// - stored berawalan v2: sudah terproses, dilewati total tanpa op apa pun,
//   sekaligus penanda idempoten tanpa kolom status.
// - stored berawalan v1: didekripsi tanpa AAD lalu dienkripsi ulang ke v2
//   dengan AAD binding keyId dan memberId.
// - DEK tidak ditemukan menjadi error dek_missing.
// - Kegagalan dekripsi envelope menjadi error envelope_corrupt tanpa crash.
// Urutan output mengikuti urutan input, dipetakan 1:1 per baris bermasalah.
export function planBackfillBatch(
  rows: BackfillRow[],
  resolveDek: DekResolver,
): BackfillOp[] {
  const ops: BackfillOp[] = [];
  for (const row of rows) {
    // Baris v2 sudah diproses sebelumnya, lewati total, bahkan tidak
    // memanggil resolver supaya batch idempoten dan murah dijalankan ulang.
    if (row.stored.startsWith('v2:')) {
      continue;
    }

    const dek = resolveDek(row.keyId);
    if (dek === null) {
      ops.push({ kind: 'error', rowId: row.id, reason: 'dek_missing' });
      continue;
    }

    if (!row.stored.startsWith('v1:')) {
      // Jalur legacy: JSON polos tanpa prefix. Parse di sini supaya kegagalan
      // parse tidak pernah melempar keluar dari perencana.
      try {
        const payload = JSON.parse(row.stored) as unknown;
        ops.push({
          kind: 'encrypt',
          rowId: row.id,
          memberId: row.memberId,
          keyId: row.keyId,
          nextStored: encryptEventPayloadV2(
            dek,
            row.keyId,
            row.memberId,
            payload,
          ),
        });
      } catch {
        ops.push({
          kind: 'error',
          rowId: row.id,
          reason: 'legacy_invalid_json',
        });
      }
      continue;
    }

    // Jalur v1: dekripsi envelope tanpa AAD lalu naik kelas ke v2. Kegagalan
    // integritas atau format ditangkap sebagai envelope_corrupt, termasuk
    // plaintext dalam envelope yang bukan JSON valid, tanpa membocorkan
    // materi kunci karena hanya kode alasan yang dilaporkan.
    try {
      const { payload } = decryptEventPayload(dek, row.keyId, row.stored);
      ops.push({
        kind: 'encrypt',
        rowId: row.id,
        memberId: row.memberId,
        keyId: row.keyId,
        nextStored: encryptEventPayloadV2(
          dek,
          row.keyId,
          row.memberId,
          payload,
        ),
      });
    } catch {
      // Semua kegagalan di jalur v1 dipetakan ke envelope_corrupt: tag GCM
      // tidak cocok, format rusak, maupun plaintext yang bukan JSON valid.
      ops.push({ kind: 'error', rowId: row.id, reason: 'envelope_corrupt' });
    }
  }
  return ops;
}
