/**
 * Scheduler backup otomatis v406. Interval dari env BACKUP_INTERVAL_HOURS,
 * default 24 jam. Startup tidak langsung membackup; pass pertama menunggu
 * satu interval penuh supaya server tidak terbebani saat boot.
 */
import { runBackup } from './backupRunner';

const HOUR_MS = 60 * 60 * 1000;

export function startBackupScheduler(): NodeJS.Timeout {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? '24');
  const intervalMs = (Number.isFinite(hours) && hours > 0 ? hours : 24) * HOUR_MS;
  const timer = setInterval(() => {
    void runBackup().catch((e) => {
      console.error('[backup] scheduled pass failed:', (e as Error).message);
    });
  }, intervalMs);
  timer.unref();
  console.log(`[backup] automatic backup scheduler running (every ${Number.isFinite(hours) && hours > 0 ? hours : 24}h)`);
  return timer;
}
