/**
 * Test v406+v407 untuk runner backup: Database (better-sqlite3) dan
 * node:fs di-mock penuh. Jalur: sukses, gagal mkdir, gagal db.backup,
 * DATABASE_URL kosong, retensi keep memanggil unlink, gagal unlink
 * individual dilog tanpa gagalkan backup, env BACKUP_KEEP, override keep,
 * di bawah keep nihil unlink, resolveBackupDir.
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
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    errLog: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
});

vi.mock('better-sqlite3', () => ({ default: mocks.DatabaseCtor }));
vi.mock('node:fs', () => ({
  mkdirSync: mocks.mkdirSync,
  readdirSync: mocks.readdirSync,
  unlinkSync: mocks.unlinkSync,
}));

async function loadRunner(): Promise<typeof import('./backupRunner')> {
  return await import('./backupRunner');
}

/** Susun nama supaya urut waktu lama ke baru: index 0 tertua. */
function names(n: number): string[] {
  return Array.from(
    { length: n },
    (_, i) => `stemmagraph-backup-20260101T0000${String(i).padStart(2, '0')}Z.db`,
  );
}

beforeEach(() => {
  mocks.mkdirSync.mockReset();
  mocks.mkdirSync.mockImplementation(() => {});
  mocks.readdirSync.mockReset();
  mocks.readdirSync.mockImplementation(() => []);
  mocks.unlinkSync.mockReset();
  mocks.unlinkSync.mockImplementation(() => {});
  mocks.backupFn.mockReset();
  mocks.closeFn.mockReset();
  mocks.DatabaseCtor.mockClear();
  mocks.errLog.mockClear();
  delete process.env['DATABASE_URL'];
  delete process.env['BACKUP_DIR'];
  delete process.env['BACKUP_KEEP'];
});

afterEach(() => {
  delete process.env['DATABASE_URL'];
  delete process.env['BACKUP_DIR'];
  delete process.env['BACKUP_KEEP'];
});

describe('runBackup', () => {
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

  it('retensi: keep 14 dari 15 file, tertua di-unlink, pruned terlapor', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    mocks.backupFn.mockResolvedValue(undefined);
    mocks.readdirSync.mockImplementation(() => names(15));
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(true);
    expect(res.pruned).toEqual([names(15)[0]]);
    expect(mocks.unlinkSync).toHaveBeenCalledTimes(1);
    expect(mocks.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(names(15)[0]));
  });

  it('retensi env BACKUP_KEEP: dipakai bila keep ops tidak diberikan', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    process.env['BACKUP_KEEP'] = '1';
    mocks.backupFn.mockResolvedValue(undefined);
    mocks.readdirSync.mockImplementation(() => names(3));
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(true);
    expect(res.pruned).toEqual([names(3)[0], names(3)[1]]);
    expect(mocks.unlinkSync).toHaveBeenCalledTimes(2);
  });

  it('retensi gagal unlink individual: dilog jujur, backup tetap ok true', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    mocks.backupFn.mockResolvedValue(undefined);
    mocks.readdirSync.mockImplementation(() => names(16));
    mocks.unlinkSync.mockImplementation(() => {
      throw new Error('EBUSY: resource busy');
    });
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(true);
    expect(res.pruned).toEqual([]);
    expect(mocks.errLog).toHaveBeenCalled();
  });

  it('keep ops meng-override env BACKUP_KEEP', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    process.env['BACKUP_KEEP'] = '3';
    mocks.backupFn.mockResolvedValue(undefined);
    mocks.readdirSync.mockImplementation(() => names(5));
    const { runBackup } = await loadRunner();
    const res = await runBackup({ keep: 2 });
    expect(res.ok).toBe(true);
    expect(res.pruned).toEqual([names(5)[0], names(5)[1], names(5)[2]]);
  });

  it('retensi: jumlah file tidak melebihi keep, nihil unlink', async () => {
    process.env['DATABASE_URL'] = 'file:./data/prod.db';
    mocks.backupFn.mockResolvedValue(undefined);
    mocks.readdirSync.mockImplementation(() => names(14));
    const { runBackup } = await loadRunner();
    const res = await runBackup();
    expect(res.ok).toBe(true);
    expect(res.pruned).toEqual([]);
    expect(mocks.unlinkSync).not.toHaveBeenCalled();
  });

  it('resolveBackupDir: default dan env', async () => {
    const { resolveBackupDir } = await loadRunner();
    expect(resolveBackupDir()).toBe('data/backups');
    process.env['BACKUP_DIR'] = 'tmp-dir-lain';
    expect(resolveBackupDir()).toBe('tmp-dir-lain');
  });
});
