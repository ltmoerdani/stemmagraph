/**
 * Modul pure wiring notifikasi erasure (GOAL v421, SLICE 1).
 * Menerjemahkan satu kejadian erasure menjadi draft notifikasi per
 * pemilik pohon keluarga: aktor tidak diberi tahu tentang aksinya
 * sendiri, setiap owner lain mendapat satu draft ERASURE_OWNER_NOTICE
 * dengan payload JSON berisi memberId, action, eventType, dan evidence.
 * Tanpa IO: tanpa database, tanpa HTTP, tanpa import server, konsisten
 * dengan gaya consent-wiring.ts. Lapisan endpoint tinggal menyuntikkan
 * sink createNotifications sehingga alur penuh bisa diuji tanpa server.
 */

/** Aksi notifikasi erasure yang diumumkan ke owner. */
export type ErasureNotifyAction = 'requested' | 'cancelled' | 'purged';

/** Isi payload notifikasi; empat kunci kontrak yang diterima owner. */
export interface ErasureOwnerNoticePayload {
  /** Member yang datanya menjadi subjek erasure. */
  memberId: string;
  /** Aksi yang sedang diumumkan. */
  action: ErasureNotifyAction;
  /** Tipe event ledger asal, dipertahankan apa adanya. */
  eventType: string;
  /** Keterangan bukti atau referensi audit yang melengkapi notifikasi. */
  evidence: string;
}

/** Bentuk draft yang diserahkan ke lapisan persistensi; id, readAt, dan createdAt milik store. */
export interface ErasureOwnerNoticeDraft {
  userId: string;
  type: 'ERASURE_OWNER_NOTICE';
  payloadJson: string;
}

/** Input proyeksi: fakta kejadian erasure plus audiens owner pohon. */
export interface ErasureNotificationInput {
  /** Member yang datanya menjadi subjek erasure. */
  memberId: string;
  /** Aksi yang sedang diumumkan. */
  action: ErasureNotifyAction;
  /** Tipe event ledger asal, dipertahankan apa adanya di payload. */
  eventType: string;
  /** Keterangan bukti atau referensi audit yang melengkapi notifikasi. */
  evidence: string;
  /** Akun yang merekam kejadian; ia tidak menerima notifikasi. */
  actorUserId: string;
  /** Audiens notifikasi: pemilik pohon tempat member terdaftar. */
  treeOwners: readonly { id: string }[];
}

/**
 * Kontrak minimal lapisan penyimpanan notifikasi. Server mengikatnya
 * ke tabel Notification; test mengikatnya ke spy. Pemisahan ini yang
 * membuat alur penuh bisa dijalankan tanpa server yang hidup.
 */
export interface ErasureNotificationSink {
  createNotifications(drafts: readonly ErasureOwnerNoticeDraft[]): Promise<unknown>;
}

/**
 * Petakan tipe event ledger erasure ke aksi notifikasi. Hanya
 * erasure.requested dan erasure.cancelled yang dipetakan eksplisit;
 * semua tipe lain, termasuk erasure.completed dan erasure.purged,
 * jatuh ke purged karena itulah kabar terakhir yang perlu dikabarkan
 * ke owner: data member sudah dihapus dari pohon.
 */
export function erasureNotifyActionFromEvent(eventType: string): ErasureNotifyAction {
  if (eventType === 'erasure.requested') return 'requested';
  if (eventType === 'erasure.cancelled') return 'cancelled';
  return 'purged';
}

/**
 * Proyeksi murni dari satu kejadian erasure menjadi daftar draft
 * notifikasi, satu per owner selain aktor. Aktor sengaja dikecualikan
 * karena ia sudah tahu aksi yang baru saja ia rekam, mirip fan-out
 * consent dan change-review. payloadJson diserialisasi satu kali agar
 * semua owner menerima fakta yang identik sehingga proyeksi tidak bisa
 * menyimpang dari kejadian yang dicatat di ledger. Validasi ketat
 * payload tetap menjadi tugas lapisan endpoint dan ledger.
 */
export function projectErasureNotifications(input: ErasureNotificationInput): ErasureOwnerNoticeDraft[] {
  const payload: ErasureOwnerNoticePayload = {
    memberId: input.memberId,
    action: input.action,
    eventType: input.eventType,
    evidence: input.evidence,
  };
  const payloadJson = JSON.stringify(payload);
  return input.treeOwners
    .filter((owner) => owner.id !== input.actorUserId)
    .map((owner) => ({ userId: owner.id, type: 'ERASURE_OWNER_NOTICE', payloadJson }));
}
