// v111 slice 1b: unit test subscribeReconnectRefresh.
// Environment node (vitest.config.ts): window dan navigator di-stub
// via vi.stubGlobal, event online dipicu manual, flush async pakai
// macrotask setTimeout 0 (pola idb.test.ts), tanpa fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeReconnectRefresh } from './reconnect';

describe('subscribeReconnectRefresh', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('(a) server lebih baru: refreshMembers dipanggil, onStatus refreshed', async () => {
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).toHaveBeenCalledWith('active');
    expect(onStatus).toHaveBeenCalledWith('refreshed', 'active');
    unsub();
  });

  it('(b) lokal lebih baru: refreshMembers tidak dipanggil, onStatus kept', async () => {
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 300 });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('kept', 'active');
    unsub();
  });

  it('(c) getLocalTree null: nihil efek samping tanpa crash', async () => {
    const getLocalTree = vi.fn().mockResolvedValue(null);
    const getServerTree = vi.fn();
    const refreshMembers = vi.fn();
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(getServerTree).not.toHaveBeenCalled();
    expect(refreshMembers).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    unsub();
  });

  it('(d) getServerTree reject: offline_still, nihil penulisan', async () => {
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockRejectedValue(new Error('network error'));
    const refreshMembers = vi.fn();
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(onStatus).toHaveBeenCalledWith('offline_still', 'active');
    expect(refreshMembers).not.toHaveBeenCalled();
    unsub();
  });

  it('(e) unsubscribe saat in-flight: nihil efek samping setelah resolve', async () => {
    let resolveServer: ((val: { savedAt: number }) => void) | null = null;
    const deferredServer = new Promise<{ savedAt: number }>((res) => {
      resolveServer = res;
    });

    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockReturnValue(deferredServer);
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    unsub();

    resolveServer?.({ savedAt: 200 });
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('(f) double online beruntun: getServerTree tepat satu panggilan', async () => {
    let serverCalls = 0;
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockImplementation(async () => {
      serverCalls++;
      await new Promise((r) => setTimeout(r, 10));
      return { savedAt: 200 };
    });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));

    await new Promise((r) => setTimeout(r, 30));

    expect(serverCalls).toBe(1);
    unsub();
  });

  it('(g) fallback onLine true saat subscribe tanpa dispatch: refresh jalan', async () => {
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).toHaveBeenCalledWith('active');
    expect(onStatus).toHaveBeenCalledWith('refreshed', 'active');
    unsub();
  });

  it('(h) fallback onLine false saat subscribe: nihil, lalu dispatch online: refresh jalan', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 100 });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(refreshMembers).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).toHaveBeenCalledWith('active');
    unsub();
  });

  it('(i) multi tree: satu tree gagal tidak menghentikan tree lain', async () => {
    const listTreeNames = vi.fn().mockResolvedValue(['a', 'b']);
    const getLocalTree = vi.fn().mockImplementation(async (name: string) => {
      if (name === 'a') throw new Error('db error');
      return { savedAt: 100 };
    });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
      listTreeNames,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).toHaveBeenCalledWith('b');
    expect(onStatus).toHaveBeenCalledWith('refreshed', 'b');
    unsub();
  });

  it('(j) savedAt lokal sama persis dengan server: kept', async () => {
    const getLocalTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const getServerTree = vi.fn().mockResolvedValue({ savedAt: 200 });
    const refreshMembers = vi.fn();
    const onStatus = vi.fn();

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      onStatus,
    });

    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));

    expect(refreshMembers).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('kept', 'active');
    unsub();
  });
});
