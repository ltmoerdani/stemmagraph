// v111 slice 1a: refresh ulang data pohon saat koneksi internet kembali.
//
// Pola mengikuti autoSave.ts: satu fungsi subscribe yang memasang
// listener event 'online' pada window dan mengembalikan fungsi
// unsubscribe untuk membersihkannya. Semua sumber data disuntik lewat
// deps supaya logika keputusan (refreshed, kept, offline_still) bisa
// diuji terpisah dari IndexedDB dan server sungguhan (test menyusul
// di slice 1b).
//
// Alur per nama pohon saat event 'online':
// 1. getLocalTree null: lewati, pohon tak punya data lokal.
// 2. getServerTree reject: server masih tak terjangkau, status
//    'offline_still', lanjut ke pohon berikutnya tanpa throw.
// 3. savedAt server lebih baru dari lokal: refreshMembers dijalankan
//    dalam try-catch, sukses berarti 'refreshed', gagal berarti
//    'kept' karena data lokal tetap dipakai.
// 4. Selain itu: 'kept', data lokal tidak ditimpa.

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
}

export function subscribeReconnectRefresh(deps: ReconnectRefreshDeps): () => void {
  const { getLocalTree, getServerTree, refreshMembers, onStatus, listTreeNames } = deps;

  const refreshAll = async (): Promise<void> => {
    const names = listTreeNames ? await listTreeNames() : ['active'];

    for (const name of names) {
      const local = await getLocalTree(name);
      if (local === null) {
        continue;
      }

      let server: ReconnectTreeMeta;
      try {
        server = await getServerTree(name);
      } catch {
        onStatus?.('offline_still', name);
        continue;
      }

      // Server tak punya record untuk pohon ini: anggap tidak lebih
      // baru, data lokal dipertahankan.
      if (server === null) {
        onStatus?.('kept', name);
        continue;
      }

      if (server.savedAt > local.savedAt) {
        try {
          await refreshMembers(name);
          onStatus?.('refreshed', name);
        } catch {
          onStatus?.('kept', name);
        }
      } else {
        onStatus?.('kept', name);
      }
    }
  };

  const handleOnline = (): void => {
    void refreshAll();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
