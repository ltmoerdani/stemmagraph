// v111 slice 1a: refresh ulang data pohon saat koneksi internet kembali.
//
// Pola mengikuti autoSave.ts: satu fungsi subscribe yang memasang
// listener event 'online' pada window dan mengembalikan fungsi
// unsubscribe untuk membersihkannya. Semua sumber data disuntik lewat
// deps supaya logika keputusan (refreshed, kept, offline_still) bisa
// diuji terpisah dari IndexedDB dan server sungguhan.
//
// Alur per nama pohon saat event 'online':
// 1. getLocalTree null atau gagal: lewati pohon ini, lanjut berikutnya.
// 2. getServerTree reject: server masih tak terjangkau, status
//    'offline_still', lanjut ke pohon berikutnya tanpa throw.
// 3. savedAt server lebih baru dari lokal: refreshMembers dijalankan
//    dalam try-catch, sukses berarti 'refreshed', gagal berarti
//    'kept' karena data lokal tetap dipakai.
// 4. Selain itu: 'kept', data lokal tidak ditimpa.
//
// Pelindung tambahan (slice 1b): flag inFlight mengabaikan pemicu
// ganda saat refresh masih berjalan, flag disposed memastikan hasil
// in-flight tidak ditulis setelah unsubscribe, dan fallback
// navigator.onLine dicek sekali saat subscribe (pemicu awal bila
// sudah online).

export type ReconnectStatus = 'refreshed' | 'kept' | 'offline_still';

export interface ReconnectTreeMeta {
  savedAt: number;
}

export interface ReconnectRefreshDeps {
  getLocalTree: (name: string) => Promise<ReconnectTreeMeta | null>;
  getServerTree: (name: string) => Promise<ReconnectTreeMeta | null>;
  refreshMembers: (name: string) => Promise<void>;
  onStatus?: (status: ReconnectStatus, treeName: string) => void;
  listTreeNames?: () => Promise<string[]>;
  /** v112 slice 3: dipanggil sekali per siklus refreshAll bila minimal satu pohon terkonfirmasi reachable. */
  onServerReachable?: () => Promise<void>;
}

export function subscribeReconnectRefresh(deps: ReconnectRefreshDeps): () => void {
  const { getLocalTree, getServerTree, refreshMembers, onStatus, listTreeNames, onServerReachable } = deps;

  let disposed = false;
  let inFlight = false;

  const refreshAll = async (): Promise<void> => {
    if (disposed || inFlight) {
      return;
    }
    inFlight = true;
    try {
      const names = listTreeNames ? await listTreeNames() : ['active'];

      // v112 slice 3: true bila minimal satu pohon terkonfirmasi server
      // reachable pada siklus ini (jalur refreshed atau kept, bukan
      // offline_still). Dipanggil sekali di akhir siklus, bukan per pohon.
      let serverReachable = false;

      for (const name of names) {
        if (disposed) {
          return;
        }

        let local: ReconnectTreeMeta | null;
        try {
          local = await getLocalTree(name);
        } catch {
          continue;
        }
        if (disposed) {
          return;
        }
        if (local === null) {
          continue;
        }

        let server: ReconnectTreeMeta | null;
        try {
          server = await getServerTree(name);
        } catch {
          if (disposed) {
            return;
          }
          onStatus?.('offline_still', name);
          continue;
        }
        if (disposed) {
          return;
        }

        // Server tak punya record untuk pohon ini: anggap tidak lebih
        // baru, data lokal dipertahankan.
        if (server === null) {
          serverReachable = true;
          onStatus?.('kept', name);
          continue;
        }

        if (server.savedAt > local.savedAt) {
          try {
            await refreshMembers(name);
            if (disposed) {
              return;
            }
            serverReachable = true;
            onStatus?.('refreshed', name);
          } catch {
            if (disposed) {
              return;
            }
            // Server menjawab, hanya refresh members yang gagal.
            serverReachable = true;
            onStatus?.('kept', name);
          }
        } else {
          serverReachable = true;
          onStatus?.('kept', name);
        }
      }

      // v112 slice 3: sekali per siklus, hanya bila minimal satu pohon
      // terkonfirmasi reachable (refreshed atau kept). Disposed dicek
      // sebelum panggil agar hasil in-flight tak diproses setelah unsub.
      if (onServerReachable && serverReachable && !disposed) {
        await onServerReachable();
      }
    } finally {
      inFlight = false;
    }
  };

  const handleOnline = (): void => {
    void refreshAll();
  };

  window.addEventListener('online', handleOnline);

  // Fallback sekali saat subscribe: bila sudah online, jalankan
  // refresh awal tanpa menunggu event berikutnya.
  if (navigator.onLine) {
    void refreshAll();
  }

  return () => {
    disposed = true;
    window.removeEventListener('online', handleOnline);
  };
}
