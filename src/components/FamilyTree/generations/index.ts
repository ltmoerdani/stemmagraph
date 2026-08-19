/**
 * Logika generasi canvas (S-09): batas generasi default-on (AC2) dan
 * keputusan onlyRenderVisibleElements (AC3). Pure functions, tanpa React.
 */
export {
  DEFAULT_GENERATION_LIMIT,
  DEFAULT_GENERATION_LIMIT_STATE,
  applyGenerationLimit,
  buildChildMap,
  collapseToDefaultLimit,
  expandAllGenerations,
  expandBranch,
  findRootGeneration,
  type GenerationLimitResult,
  type GenerationLimitState,
} from './generationLimit';
export { shouldOnlyRenderVisibleElements } from './visibility';
export {
  groupMembersByGeneration,
  hydrateStableByKey,
  type HydrationOutput,
  type HydrationSpec,
  type StableHydrationEntry,
} from './hydration';
