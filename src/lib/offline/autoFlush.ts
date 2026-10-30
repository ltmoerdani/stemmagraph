// v112 slice 3 (bagian C): keputusan auto flush outbox saat koneksi kembali.
// countOutbox dihitung dulu: tanpa entry, fungsi diam. Ada entry, user
// dikonfirmasi lewat deps.confirm; setuju berarti flush dijalankan, gagal
// atau sukses dilaporkan lewat onDone. Guard inFlight modul-level (pola
// slice 1b reconnect) diambil sebelum confirm sehingga pemanggilan
// bersamaan menghasilkan tepat satu confirm dan satu flush; pemanggil
// kedua kembali tanpa efek. Guard dilepas di finally.

export type AutoFlushDoneStatus = 'flushed' | 'failed' | 'declined';

export interface AutoFlushDeps {
  countOutbox: () => Promise<number>;
  confirm: (count: number) => Promise<boolean>;
  flush: () => Promise<void>;
  onDone?: (status: AutoFlushDoneStatus, remaining: number) => void;
}

// Guard modul-level: satu auto flush pada satu waktu untuk seluruh aplikasi.
let inFlight = false;

export async function maybeAutoFlush(deps: AutoFlushDeps): Promise<void> {
  const count = await deps.countOutbox();

  // Outbox kosong: tanpa konfirmasi, tanpa laporan, tanpa sentuhan state.
  if (count === 0) {
    return;
  }

  // Pemanggil bersamaan saat siklus lain masih berjalan: langsung kembali.
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    const ok = await deps.confirm(count);
    if (!ok) {
      deps.onDone?.('declined', count);
      return;
    }

    try {
      await deps.flush();
      deps.onDone?.('flushed', 0);
    } catch {
      deps.onDone?.('failed', count);
    }
  } finally {
    inFlight = false;
  }
}
