import { getOrCreateDek, getDekByKeyId } from '../../lib/crypto/family-key-store';
import {
  decryptEventPayload,
  encryptEventPayload,
} from '../../lib/crypto/event-payload-cipher';

/**
 * Helper crypto wiring bersama untuk lapisan IO erasure (GOAL v422 SLICE 2C
 * bagian 1). Mengikat family-key-store dan event-payload-cipher ke bentuk
 * siap pakai untuk route/scheduler: resolve treeId member dari prisma,
 * enkripsi event fail-open terkontrol saat env belum siap, serta filter
 * baris event per member dengan dekripsi aman (baris rusak dilewati, tidak
 * pernah melempar). Prisma di-inject sebagai tipe struktural, tanpa import
 * client konkret. Sejak v423 slice 3b1, baris event dengan keyId generasi
 * lama tetap terbaca lewat resolver DEK per keyId opsional. Bebas em dash.
 */

/** Bentuk prisma minimal untuk resolve treeId member. Struktural, di-inject. */
export interface ErasureCryptoPrismaClient {
  familyMember: {
    findUnique(args: {
      where: { id: string };
      select?: { treeId?: boolean };
    }): Promise<{ treeId?: string } | null>;
  };
}

// Resolver DEK berdasar keyId: mengembalikan Buffer kunci atau null bila
// keyId tidak dikenal atau kunci tidak bisa dibaca. Tidak pernah melempar.
export type DekForKeyIdResolver = (keyId: string) => Buffer | null;

// Closure resolver DEK per keyId untuk satu treeId: membungkus getDekByKeyId
// dengan try/catch sehingga selalu null bila gagal, tanpa pernah membuat
// kunci baru. Tidak pernah me-log materi kunci.
export function resolveDekForKeyId(treeId: string): DekForKeyIdResolver {
  return (keyId: string): Buffer | null => {
    try {
      return getDekByKeyId(treeId, keyId);
    } catch {
      return null;
    }
  };
}

// Resolve treeId milik seorang member: null bila member tidak ada atau
// treeId kosong. Pola identik erasure-notify-wiring.ts.
export async function resolveTreeIdForMember(
  prisma: ErasureCryptoPrismaClient,
  memberId: string,
): Promise<string | null> {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    select: { treeId: true },
  });
  if (member === null || !member.treeId) {
    return null;
  }
  return member.treeId;
}

// Enkripsi event untuk penulisan: bila DEK tidak bisa disiapkan (misal
// STMG_MASTER_KEY kosong) event diteruskan sebagai plaintext JSON dengan
// flag encrypted false, fail-open terkontrol. console.warn satu baris dan
// tidak pernah memuat isi payload.
export function encryptEventForWrite(
  treeId: string,
  payload: unknown,
): { stored: string; encrypted: boolean } {
  let dek: Buffer;
  let keyId: string;
  try {
    const resolved = getOrCreateDek(treeId);
    dek = resolved.dek;
    keyId = resolved.keyId;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'kesalahan tidak diketahui';
    console.warn(`Event keluarga tersimpan tanpa enkripsi, DEK tidak tersedia: ${reason}`);
    return { stored: JSON.stringify(payload), encrypted: false };
  }
  return {
    stored: encryptEventPayload(dek, keyId, payload),
    encrypted: true,
  };
}

// Cek kepemilikan event: payload wajib objek dengan field memberId yang
// cocok dengan parameter. Objek lain, null, atau tipe primitif dianggap
// bukan milik member mana pun.
function isEventForMember(payload: unknown, memberId: string): boolean {
  if (payload === null || typeof payload !== 'object') {
    return false;
  }
  return (payload as { memberId?: unknown }).memberId === memberId;
}

// Resolve DEK untuk treeId tanpa melempar: bungkus getOrCreateDek dengan
// try/catch, null bila gagal (mis. STMG_MASTER_KEY kosong atau kunci rusak
// di disk). Tidak pernah me-log isi kunci maupun materi turunannya.
export function resolveDekOrNull(
  treeId: string,
): { dek: Buffer; keyId: string } | null {
  try {
    return getOrCreateDek(treeId);
  } catch {
    return null;
  }
}

// Pilih DEK dan keyId untuk satu row terenkripsi (prefix v1: atau v2:).
// Bila resolver diset, keyId dibaca dari envelope row itu dan DEK dicari
// lewat resolver; null dari resolver berarti fallback ke pasangan dek dan
// keyId parameter seperti jalur lama. Tanpa resolver, perilaku existing
// 100 persen dipertahankan. Mengembalikan null bila keduanya nihil.
function pilihDekForRow(
  payloadJson: string,
  dek: Buffer | null,
  keyId: string,
  resolveDekForKeyId?: DekForKeyIdResolver,
): { dek: Buffer; keyId: string } | null {
  if (resolveDekForKeyId === undefined) {
    return dek === null ? null : { dek, keyId };
  }
  const segments = payloadJson.split(':');
  if (segments.length !== 5) {
    return null;
  }
  const keyIdEnvelope = segments[1];
  const dekEnvelope = resolveDekForKeyId(keyIdEnvelope);
  if (dekEnvelope !== null) {
    return { dek: dekEnvelope, keyId: keyIdEnvelope };
  }
  return dek === null ? null : { dek, keyId };
}

// Dekripsi satu row terenkripsi v1 atau v2 dengan pasangan dek dan keyId
// yang sudah dipilih. v2 memakai AAD binding memberId, v1 tanpa memberId.
// Melempar bila gagal, penanganan skip ada di pemanggil.
function dekripsiRowTerenkripsi(
  dek: Buffer,
  keyId: string,
  stored: string,
  memberId: string,
): unknown {
  if (stored.startsWith('v2:')) {
    return decryptEventPayload(dek, keyId, stored, { memberId }).payload;
  }
  return decryptEventPayload(dek, keyId, stored).payload;
}

// Seleksi plus konversi baris event per member ke plaintext. Row terenkripsi
// (prefix v1: atau v2:) hanya bisa dibaca bila dek tersedia: dengan resolver
// opsional, keyId diambil dari envelope row itu sehingga generasi kunci lama
// tetap terbaca; tanpa resolver, jalur lama dipakai apa adanya. Bila dek null
// atau dekripsi gagal, row di-skip dengan console.error tanpa membocorkan
// materi kunci; bila berhasil dan payload milik member, kembalikan row dengan
// payloadJson berupa JSON plaintext hasil dekripsi. Row legacy (tanpa
// prefix) diparse langsung: bukan JSON valid di-skip dengan console.error,
// milik member dikembalikan apa adanya dengan payloadJson asli.
export function listMemberEventRows(
  rows: Array<{ type: string; payloadJson: string }>,
  dek: Buffer | null,
  keyId: string,
  memberId: string,
  resolveDekForKeyId?: DekForKeyIdResolver,
): Array<{ type: string; payloadJson: string }> {
  const result: Array<{ type: string; payloadJson: string }> = [];
  for (const row of rows) {
    if (
      row.payloadJson.startsWith('v1:') ||
      row.payloadJson.startsWith('v2:')
    ) {
      const terpilih = pilihDekForRow(row.payloadJson, dek, keyId, resolveDekForKeyId);
      if (terpilih === null) {
        console.error(
          `Row event terenkripsi dilewati, DEK tidak tersedia untuk keyId ${keyId}`,
        );
        continue;
      }
      let payload: unknown;
      try {
        payload = dekripsiRowTerenkripsi(
          terpilih.dek,
          terpilih.keyId,
          row.payloadJson,
          memberId,
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'kesalahan tidak diketahui';
        console.error(`Row event terenkripsi gagal dekripsi, dilewati: ${reason}`);
        continue;
      }
      if (isEventForMember(payload, memberId)) {
        result.push({ type: row.type, payloadJson: JSON.stringify(payload) });
      }
      continue;
    }
    // Legacy plaintext: JSON polos tanpa prefix, diparse tanpa DEK.
    let legacyPayload: unknown;
    try {
      legacyPayload = JSON.parse(row.payloadJson) as unknown;
    } catch {
      console.error('Row event legacy bukan JSON valid, dilewati');
      continue;
    }
    if (isEventForMember(legacyPayload, memberId)) {
      result.push(row);
    }
  }
  return result;
}

// Filter baris event per member. Row terenkripsi (prefix v1: atau v2:)
// didukung multi-key lewat resolver DEK per keyId opsional: keyId dibaca
// dari envelope row, generasi lama tetap terbaca, fallback ke dek param
// bila resolver nihil. Row terenkripsi tanpa dek yang cocok dilewati, dan
// baris yang gagal dekripsi (tampered, AAD mismatch, format rusak)
// dilewati dengan console.error tanpa membocorkan materi kunci. Row legacy
// plaintext diparse langsung tanpa DEK. Baris yang lolos disertakan apa
// adanya dengan payloadJson asli, tidak pernah menulis ulang isi row.
export function filterEventsByMember(
  rows: Array<{ type: string; payloadJson: string }>,
  dek: Buffer | null,
  keyId: string,
  memberId: string,
  resolveDekForKeyId?: DekForKeyIdResolver,
): Array<{ type: string; payloadJson: string }> {
  const result: Array<{ type: string; payloadJson: string }> = [];
  for (const row of rows) {
    if (
      row.payloadJson.startsWith('v1:') ||
      row.payloadJson.startsWith('v2:')
    ) {
      const terpilih = pilihDekForRow(row.payloadJson, dek, keyId, resolveDekForKeyId);
      if (terpilih === null) {
        console.error(
          `Row event terenkripsi dilewati, DEK tidak tersedia untuk keyId ${keyId}`,
        );
        continue;
      }
      let payload: unknown;
      try {
        payload = dekripsiRowTerenkripsi(
          terpilih.dek,
          terpilih.keyId,
          row.payloadJson,
          memberId,
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'kesalahan tidak diketahui';
        console.error(`Row event terenkripsi gagal dekripsi, dilewati: ${reason}`);
        continue;
      }
      if (isEventForMember(payload, memberId)) {
        result.push(row);
      }
      continue;
    }
    // Legacy plaintext: JSON polos tanpa prefix, diparse tanpa DEK.
    let legacyPayload: unknown;
    try {
      legacyPayload = JSON.parse(row.payloadJson) as unknown;
    } catch {
      console.error('Row event legacy bukan JSON valid, dilewati');
      continue;
    }
    if (isEventForMember(legacyPayload, memberId)) {
      result.push(row);
    }
  }
  return result;
}
