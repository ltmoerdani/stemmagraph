// v112 slice 3: unit test maybeAutoFlush (bagian C).
// Lingkungan node, semua deps in-memory, pola reconnect.test.ts
// (flush async pakai macrotask setTimeout 0, tanpa fake timers).
import { describe, expect, it, vi } from 'vitest';
import { maybeAutoFlush } from './autoFlush';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('maybeAutoFlush', () => {
  it('(1) count 0: return diam, confirm tidak terpanggil', async () => {
    const countOutbox = vi.fn().mockResolvedValue(0);
    const confirm = vi.fn().mockResolvedValue(true);
    const flush = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();

    await maybeAutoFlush({ countOutbox, confirm, flush, onDone });

    expect(countOutbox).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('(2) konfirmasi ditolak: onDone declined, outbox tetap (flush tidak terpanggil)', async () => {
    const countOutbox = vi.fn().mockResolvedValue(3);
    const confirm = vi.fn().mockResolvedValue(false);
    const flush = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();

    await maybeAutoFlush({ countOutbox, confirm, flush, onDone });

    expect(confirm).toHaveBeenCalledWith(3);
    expect(flush).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith('declined', 3);
  });

  it('(3) konfirmasi diterima: flush terpanggil, onDone flushed 0', async () => {
    const countOutbox = vi.fn().mockResolvedValue(2);
    const confirm = vi.fn().mockResolvedValue(true);
    const flush = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();

    await maybeAutoFlush({ countOutbox, confirm, flush, onDone });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('flushed', 0);
  });

  it('(4) flush throw: onDone failed dengan count awal', async () => {
    const countOutbox = vi.fn().mockResolvedValue(4);
    const confirm = vi.fn().mockResolvedValue(true);
    const flush = vi.fn().mockRejectedValue(new Error('network down'));
    const onDone = vi.fn();

    await maybeAutoFlush({ countOutbox, confirm, flush, onDone });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('failed', 4);
  });

  it('(5) double invoke bersamaan: hanya satu confirm dan satu flush (inFlight guard)', async () => {
    let releaseConfirm: ((ok: boolean) => void) | null = null;
    const confirmGate = new Promise<boolean>((res) => {
      releaseConfirm = res;
    });

    const countOutbox = vi.fn().mockResolvedValue(5);
    const confirm = vi.fn().mockReturnValue(confirmGate);
    const flush = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();

    const first = maybeAutoFlush({ countOutbox, confirm, flush, onDone });
    const second = maybeAutoFlush({ countOutbox, confirm, flush, onDone });

    await tick();
    expect(confirm).toHaveBeenCalledTimes(1);

    releaseConfirm?.(true);
    await Promise.all([first, second]);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('flushed', 0);

    // Guard dilepas: siklus berikutnya jalan normal.
    await maybeAutoFlush({ countOutbox, confirm, flush, onDone });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenCalledTimes(2);
  });
});
