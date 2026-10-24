/**
 * Digest sent notification (v387): modul PURE untuk jejak in-app saat
 * digest mingguan benar-benar terkirim. Saudara dari pola projeksi
 * Notification di src/lib/events/index.ts: satu draft siap
 * prisma.notification.create, tanpa import server/, tanpa prisma,
 * tanpa jam tersembunyi (semua Date masuk lewat argumen).
 *
 * Jejak dibuat HANYA untuk send nyata: dry-run mailer (rehearsal) dan
 * digest kosong tidak menghasilkan Notification. Payload membawa label
 * jendela ISO, subjek, dan hitungan ringkas; tanpa alamat email, tanpa
 * token, tanpa fragmen payloadJson (pagaran privasi pola builder).
 */

export const DIGEST_SENT_NOTIFICATION_TYPE = 'digest_sent' as const

export interface DigestSentWindowRef {
  readonly startAt: Date
  readonly endAt: Date
}

export interface DigestSentDigestRef {
  readonly subject: string
  readonly treeCount: number
  readonly reminderCount: number
}

export interface DigestSentNotificationPayload {
  /** Hari pertama jendela digest, format YYYY-MM-DD (UTC). */
  readonly windowStart: string
  /** Hari terakhir jendela digest (endAt minus satu hari), YYYY-MM-DD. */
  readonly windowEnd: string
  readonly subject: string
  readonly treeCount: number
  readonly reminderCount: number
}

export interface DigestSentNotificationDraft {
  readonly userId: string
  readonly type: typeof DIGEST_SENT_NOTIFICATION_TYPE
  readonly payloadJson: string
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Membangun satu draft Notification jejak kirim digest. Murni: masukan
 * sama, keluaran sama, tanpa baca jam dan tanpa efek samping.
 */
export function buildDigestSentNotification(
  userId: string,
  digest: DigestSentDigestRef,
  window: DigestSentWindowRef,
): DigestSentNotificationDraft {
  const payload: DigestSentNotificationPayload = {
    windowStart: isoDay(window.startAt),
    windowEnd: isoDay(new Date(window.endAt.getTime() - 86_400_000)),
    subject: digest.subject,
    treeCount: digest.treeCount,
    reminderCount: digest.reminderCount,
  }
  return {
    userId,
    type: DIGEST_SENT_NOTIFICATION_TYPE,
    payloadJson: JSON.stringify(payload),
  }
}
