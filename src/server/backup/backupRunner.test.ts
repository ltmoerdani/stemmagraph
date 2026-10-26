/**
 * Test v406 untuk runner backup: Database (better-sqlite3) dan node:fs
 * di-mock penuh. Tiga jalur: sukses menghasilkan path, gagal mkdir
 * dilog jujur ok:false, gagal db.backup ok:false tanpa throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const backupFn = vi.fn();
  const closeFn = vi.fn();
  // normal function, bukan arrow: harus bisa dipanggil dengan new
  const DatabaseCtor = vi.fn(function () {
    return { backup: backupFn, close: closeFn };
  });
  return {
    DatabaseCtor,
    backupFn,
    closeFn,
    mkdirSync: vi.fn(),
    errLog: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
});

vi.mock('better-sqlite3', () => ({ default: mocks.DatabaseCtor }));
vi.mock('node:fs', () => ({ mkdirSync: mocks.mkdirSync }));

async function loadRunner(): Promise<typeof import('./backupRunner')> {
  return await import('./backupRunner');
}

describe('runBackup', () => {
  beforeEach(() => {
    mocks.mkdirSync.mockReset();
    mocks.mkdirSync.mockImplementation(() => {});
    mocks.backupFn.mockReset();
    mocks.closeFn.mockReset();
    mocks.DatabaseCtor.mockClear();
    mocks.errLog.mockClear();
    delete process.env['DATABASE_URL'];
    delete process.env['BACKUP_DIR'];
  });

  afterEach(() => {
    delete process.env['DATABASE_URL'];
    delete process.env['BACKUP_DIR'];
  });

  it('sukses: mkdir recursive, db.backup ke path ber-stempel, return ok true + path', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    process.env['BACKUP_DIR'] = 'tmp-backups-uji';
    mocks.backupFn.mockResolvedValue(undefined);
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.error ?? '', JSON.stringify(res)).toBe('');
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect(res.path!.startsWith('tmp-backups-uji/stemmagraph-backup-')).toBe(true);
    expect(res.path!.endsWith('.db')).toBe(true);
    expect(mocks.mkdirSync).toHaveBeenCalledWith('tmp-backups-uji', { recursive: true });
    expect(mocks.DatabaseCtor).toHaveBeenCalledWith('./data/prod.db');
    expect(mocks.backupFn).toHaveBeenCalledTimes(1);
    expect(mocks.closeFn).toHaveBeenCalled();
  });

  it('gagal mkdir: dilog jujur, ok false, tidak throw', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    mocks.mkdirSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('EACCES');
    expect(mocks.errLog).toHaveBeenCalled();
    expect(mocks.DatabaseCtor).not.toHaveBeenCalled();
  });

  it('gagal db.backup: ok false tanpa throw, error tersaji', async () => {
    process.env['DATABASE_URL'] = './data/prod.db';
    mocks.backupFn.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('SQLITE_BUSY');
    expect(mocks.errLog).toHaveBeenCalled();
    expect(mocks.closeFn).toHaveBeenCalled();
  });

  it('DATABASE_URL kosong: ok false dengan pesan jelas', async () => {
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('DATABASE_URL');
  });
});
