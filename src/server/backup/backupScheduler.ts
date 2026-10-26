/**
 * Scheduler backup otomatis v406+v407. Interval dari env
 * BACKUP_INTERVAL_HOURS, default 24 jam. Startup tidak membackup kecuali
 * env BACKUP_ON_BOOT=true (opsi fase 2, default false mempertahankan
 * perilaku v406: pass pertama menunggu satu interval penuh).
 */
import { runBackup } from './backupRunner';

const HOUR_MS = 60 * 60 * 1000;

export function startBackupScheduler(): NodeJS.Timeout {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? '24');
  const intervalMs = (Number.isFinite(hours) && hours > 0 ? hours : 24) * HOUR_MS;
  if (process.env.BACKUP_ON_BOOT === 'true') {
    void runBackup().catch((e) => {
      console.error('[backup] boot pass failed:', (e as Error).message);
    });
  }
  const timer = setInterval(() => {
    void runBackup().catch((e) => {
      console.error('[backup] scheduled pass failed:', (e as Error).message);
    });
  }, intervalMs);
  timer.unref();
  const bootNote = process.env.BACKUP_ON_BOOT === 'true' ? ', boot pass aktif' : '';
  console.log(`[backup] automatic backup scheduler running (every ${Number.isFinite(hours) && hours > 0 ? hours : 24}h${bootNote})`);
  return timer;
}
