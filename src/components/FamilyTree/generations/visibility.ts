/**
 * Keputusan onlyRenderVisibleElements (S-09 AC3).
 *
 * Prop React Flow aktif default, tapi otomatis OFF bila jumlah node yang
 * akan render di bawah ambang 500: untuk graf kecil, biaya viewport
 * culling lebih besar daripada untungnya. Kasus batas: 499 OFF,
 * 500 ON, 501 ON.
 *
 * Override eksperimen v177-ii: query param perfVisibility=on|off atau env
 * VITE_PERF_FORCE_VISIBILITY memaksa mode A/B tanpa edit kode per run.
 * Tanpa keduanya, keputusan threshold default utuh (perilaku tidak berubah).
 */
export const ONLY_RENDER_VISIBLE_ELEMENTS_THRESHOLD = 500;

/** Membaca override perf: 'on' | 'off' | undefined (tak di-set). */
const readPerfVisibilityOverride = (): 'on' | 'off' | undefined => {
  // Prioritas: query param (dipakai harness browser), lalu env build.
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('perfVisibility');
    if (fromQuery === 'on' || fromQuery === 'off') return fromQuery;
  } catch {
    // Lingkungan tanpa window (test node): lanjut ke env.
  }
  const fromEnv = import.meta.env.VITE_PERF_FORCE_VISIBILITY;
  if (fromEnv === 'on' || fromEnv === 'off') return fromEnv;
  return undefined;
};

export const shouldOnlyRenderVisibleElements = (nodeCount: number): boolean => {
  const override = readPerfVisibilityOverride();
  if (override === 'on') return true;
  if (override === 'off') return false;
  return nodeCount >= ONLY_RENDER_VISIBLE_ELEMENTS_THRESHOLD;
};
