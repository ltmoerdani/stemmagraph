/**
 * Stub tipe ambient untuk self-check TS tests/perf (test-only).
 *
 * Program TS perf sengaja TIDAK menarik src/ (ratusan error type
 * pra-eksisting di luar cakupan baseline ini, dilarang disentuh).
 * Alias @ dinonaktifkan di tsconfig.json perf sehingga import
 * runtime vitest tetap menunjuk fixture asli lewat alias di
 * vitest.perf.config.ts, sementara tsc memakai stub di bawah.
 */
declare module '@/components/FamilyTree/__perf__/perf-graph-fixtures' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export const buildPerfNode: (
    id: string,
    generation: number,
    parentIds?: string[]
  ) => any;
  export const buildPerfEdge: (id: string, source: string, target: string) => any;
}
