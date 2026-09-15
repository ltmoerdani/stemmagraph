/**
 * Modul layout engine (S-09 AC1).
 *
 * Komponen React memanggil layout lewat interface LayoutEngine dari sini;
 * detail dagre dan perhitungan tier disembunyikan di dalam modul.
 */
export type {
  LayoutDirection,
  LayoutEngine,
  LayoutEngineMeta,
  LayoutEngineOptions,
  LayoutResult,
  LayoutSnapGrid,
} from './types';
export { DagreTierEngine, dagreTierEngine, getSnapGrid } from './dagreTierEngine';
export {
  calculateTierLayout,
  constrainNodeMovement,
  type TierLayout,
} from './tierLayout';
