/**
 * Wiring scheduler pemberitahuan penerima data (STG v127-iii).
 * Menghubungkan modul pure evaluateRecipientNotification ke daftar
 * TreeShareLink aktif melalui prisma, dengan pola yang sama seperti
 * erasure-purge-scheduler-wiring: interval default 1 jam, guard agar
 * tick tumpang tindih dilewati, error per tick ditelan dan dilog,
 * serta handle stop dan runOnce untuk pengujian.
 * Fase ini murni evaluasi dan log: tanpa email, tanpa tulis database,
 * tanpa perubahan data apa pun.
 * Bebas em dash, sesuai standar Anti-AI.
 */

import { evaluateRecipientNotification } from '../../lib/consent/data-recipient-notification';

/** Satu baris link aktif: id tree dan waktu pemakaian terakhir. */
export interface ActiveShareLinkRow {
  treeId: string;
  lastUsedAt: Date | null;
}

/** Sumber daftar link aktif, dapat diinjeksi untuk pengujian. */
export type FetchActiveLinks = () => Promise<ActiveShareLinkRow[]>;

/** Ringkasan satu kali scan pemberitahuan penerima data. */
export interface NotificationScanSummary {
  /** Jumlah link yang dinilai. */
  evaluated: number;
  /** Jumlah verdict notify. */
  notify: number;
  /** Jumlah verdict exempt. */
  exempt: number;
  /** Jumlah verdict defer. */
  defer: number;
}

export interface ConsentNotificationSchedulerOptions {
  /** Instance prisma nyata, dipakai hanya bila fetchActiveLinks tidak diinjeksi. */
  prisma: unknown;
  /** Jarak antar tick, default 3600000 ms (1 jam). */
  intervalMs?: number;
  /** Saluran log, default console.log dengan prefiks. */
  log?: (msg: string) => void;
  /** Sumber waktu penilaian, dapat diinjeksi agar deterministik. */
  nowIso?: () => string;
  /** Sumber daftar link aktif, dapat diinjeksi untuk pengujian. */
  fetchActiveLinks?: FetchActiveLinks;
}

export interface ConsentNotificationSchedulerHandle {
  stop(): void;
  runOnce(): Promise<NotificationScanSummary>;
}

const EMPTY_SUMMARY: NotificationScanSummary = {
  evaluated: 0,
  notify: 0,
  exempt: 0,
  defer: 0,
};

/**
 * Membangun fetchActiveLinks standar dari prisma: seluruh TreeShareLink
 * yang belum di-revoke, dengan select treeId dan lastUsedAt saja.
 */
function buildDefaultFetchActiveLinks(prisma: unknown): FetchActiveLinks {
  return () => {
    const client = prisma as {
      treeShareLink?: {
        findMany(args: {
          where: { revokedAt: null };
          select: { treeId: boolean; lastUsedAt: boolean };
        }): Promise<ActiveShareLinkRow[]>;
      };
    };
    const delegate = client.treeShareLink;
    if (!delegate || typeof delegate.findMany !== 'function') {
      return Promise.reject(new Error('prisma.treeShareLink.findMany tidak tersedia'));
    }
    return delegate.findMany({
      where: { revokedAt: null },
      select: { treeId: true, lastUsedAt: true },
    });
  };
}

/**
 * Membuat dan memulai scheduler pemberitahuan penerima data.
 * Menjadwalkan scan periodic dengan interval default 1 jam (3600000 ms),
 * melindungi dari eksekusi tumpang tindih (reentrant guard), menelan
 * error per tick, dan mengembalikan handle stop serta runOnce.
 * Scan hanya menilai dan melog ringkasan, tidak ada efek samping data.
 */
export function createConsentNotificationScheduler(
  options: ConsentNotificationSchedulerOptions,
): ConsentNotificationSchedulerHandle {
  const intervalMs = options.intervalMs ?? 3600000;
  const fetchActiveLinks = options.fetchActiveLinks ?? buildDefaultFetchActiveLinks(options.prisma);
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const log = options.log ?? ((msg: string) => console.log(`[consent-notification-scheduler] ${msg}`));

  let running = false;
  let activeTick = false;
  let timer: NodeJS.Timeout | null = null;

  async function runOnce(): Promise<NotificationScanSummary> {
    if (activeTick) {
      log('scan dilewati: tick sebelumnya masih berjalan');
      return { ...EMPTY_SUMMARY };
    }
    activeTick = true;
    try {
      const links = await fetchActiveLinks();
      const summary: NotificationScanSummary = { ...EMPTY_SUMMARY };
      const now = nowIso();
      for (const link of links) {
        const verdict = evaluateRecipientNotification({
          recipientCount: 1,
          lastBackupAt: link.lastUsedAt ? link.lastUsedAt.toISOString() : undefined,
          deceasedFlag: false,
          nowIso: now,
        });
        summary.evaluated += 1;
        if (verdict.decision === 'notify') {
          summary.notify += 1;
        } else if (verdict.decision === 'exempt') {
          summary.exempt += 1;
        } else {
          summary.defer += 1;
        }
      }
      log(
        `scan selesai: ${summary.evaluated} link dinilai, ${summary.notify} notify, ${summary.exempt} exempt, ${summary.defer} defer`,
      );
      return summary;
    } catch (err) {
      log('error pada tick scan pemberitahuan, ditelan:', (err as Error).message);
      return { ...EMPTY_SUMMARY };
    } finally {
      activeTick = false;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    timer = setInterval(() => {
      runOnce().catch((err) => {
        log('error tick setInterval ditelan:', (err as Error).message);
      });
    }, intervalMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Otomatis mulai saat diciptakan, konsisten dengan pola erasure purge
  start();

  return {
    stop,
    runOnce,
  };
}
