/**
 * Keputusan onlyRenderVisibleElements (S-09 AC3).
 *
 * Prop React Flow aktif default, tapi otomatis OFF bila jumlah node yang
 * akan render di bawah ambang 500: untuk graf kecil, biaya viewport
 * culling lebih besar daripada untungnya. Kasus batas: 499 OFF,
 * 500 ON, 501 ON.
 */
export const ONLY_RENDER_VISIBLE_ELEMENTS_THRESHOLD = 500;

export const shouldOnlyRenderVisibleElements = (nodeCount: number): boolean =>
  nodeCount >= ONLY_RENDER_VISIBLE_ELEMENTS_THRESHOLD;
