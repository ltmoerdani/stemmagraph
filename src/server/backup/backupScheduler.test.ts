/**
 * Test v407 AC3: perilaku boot scheduler backup.
 * BACKUP_ON_BOOT false/absen: nihil pass boot (pola v406).
 * BACKUP_ON_BOOT=true: tepat satu pass boot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runBackup: vi.fn(),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  errLog: vi.spyOn(console, 'error').mockImplementation(() => {}),
}));

vi.mock('./backupRunner', () => ({ runBackup: mocks.runBackup }));

async function loadScheduler(): Promise<typeof import('./backupScheduler')> {
  return await import('./backupScheduler');
}

beforeEach(() => {
  mocks.runBackup.mockReset();
  mocks.runBackup.mockResolvedValue({ ok: true });
  mocks.log.mockClear();
  mocks.errLog.mockClear();
  delete process.env['BACKUP_ON_BOOT'];
  delete process.env['BACKUP_INTERVAL_HOURS'];
});

afterEach(() => {
  delete process.env['BACKUP_ON_BOOT'];
  delete process.env['BACKUP_INTERVAL_HOURS'];
});

describe('startBackupScheduler boot pass', () => {
  it('default: nihil pass boot, scheduler tetap menyala', async () => {
    const { startBackupScheduler } = await loadScheduler();
    const timer = startBackupScheduler();
    timer.unref();
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.runBackup).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
    clearInterval(timer);
  });

  it('BACKUP_ON_BOOT=true: tepat satu pass boot', async () => {
    process.env['BACKUP_ON_BOOT'] = 'true';
    const { startBackupScheduler } = await loadScheduler();
    const timer = startBackupScheduler();
    timer.unref();
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.runBackup).toHaveBeenCalledTimes(1);
    clearInterval(timer);
  });

  it('BACKUP_ON_BOOT=true dan pass gagal: dilog, tidak throw', async () => {
    process.env['BACKUP_ON_BOOT'] = 'true';
    mocks.runBackup.mockRejectedValue(new Error('boom'));
    const { startBackupScheduler } = await loadScheduler();
    const timer = startBackupScheduler();
    timer.unref();
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.runBackup).toHaveBeenCalledTimes(1);
    expect(mocks.errLog).toHaveBeenCalled();
    clearInterval(timer);
  });
});
