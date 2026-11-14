/* eslint-disable react-refresh/only-export-components */
/**
 * Host halaman perf benchmark canvas v442 AC2 (test-only, dilayani vite dev).
 *
 * Dataset realistis dari fixture __perf__/perf-graph-sizes (buildPerfFamily)
 * via query param: ?nodes=2000 dan opsional &perfVisibility=on|off untuk A/B
 * AC4 (override dibaca visibility.ts, perilaku app default tidak berubah).
 * Host merekam durasi initial load (mount sampai paint settle) di
 * window.__perfLoadMs dan menandai window.__perfReady untuk runner.
 */
import { createRoot } from 'react-dom/client';
import { ReactFlowFamilyTree } from '/src/components/FamilyTree/ReactFlowFamilyTree';
import { buildPerfFamily } from '/src/components/FamilyTree/__perf__/perf-graph-sizes';

const params = new URLSearchParams(window.location.search);
const nodeCount = Number(params.get('nodes') ?? '2000');

const t0 = performance.now();
const { members } = buildPerfFamily(nodeCount);
const mount = document.getElementById('root') as HTMLElement;

const App = () => <ReactFlowFamilyTree members={members} />;

createRoot(mount).render(<App />);

// Initial load: build dataset + mount + layout + render pertama + jeda
// 250ms menutup fitView delayed komponen (setTimeout 100ms) lalu dua rAF
// memastikan paint settle. Angka mentah direkam, runner tinggal membaca.
window.setTimeout(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const w = window as unknown as {
        __perfReady?: boolean;
        __perfLoadMs?: number;
        __layoutWorkerActive?: boolean;
      };
      w.__perfLoadMs = performance.now() - t0;
      // v458: probe jalur compute; true berarti worker hidup, false
      // berarti fallback main-thread (worker tidak tersedia atau gagal).
      w.__layoutWorkerActive = layoutService.respondedViaWorker;
      w.__perfReady = true;
    });
  });
}, 250);
