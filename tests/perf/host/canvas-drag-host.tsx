/* eslint-disable react-refresh/only-export-components */
/**
 * Host halaman perf drag canvas v395 (test-only, dilayani vite dev).
 *
 * Dataset generatif via query param: ?nodes=241. Pola sama dengan
 * canvas-ab-host.tsx v177-ii, tanpa query param visibility karena memo
 * edge tidak punya flag on-off (non-goal); kondisi yang diukur adalah
 * build kini. Default app tanpa param tidak berubah.
 */
import { createRoot } from 'react-dom/client';
import { ReactFlowFamilyTree } from '/src/components/FamilyTree/ReactFlowFamilyTree';
import type { FamilyMember } from '/src/types/family';

const params = new URLSearchParams(window.location.search);
const nodeCount = Number(params.get('nodes') ?? '241');

const buildMembers = (count: number): FamilyMember[] => {
  const members: FamilyMember[] = [];
  for (let i = 0; i < count; i += 1) {
    members.push({
      id: `perf-${i}`,
      name: `Perf Member ${i}`,
      birthDate: '1990-01-01',
      gender: i % 2 === 0 ? 'male' : 'female',
      isAlive: true,
      generation: i,
      maritalStatus: 'single',
      parentIds: i > 0 ? [`perf-${i - 1}`] : undefined,
    });
  }
  return members;
};

const mount = document.getElementById('root') as HTMLElement;

const App = () => <ReactFlowFamilyTree members={buildMembers(nodeCount)} />;

createRoot(mount).render(<App />);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as unknown as { __perfReady: boolean }).__perfReady = true;
  });
});
