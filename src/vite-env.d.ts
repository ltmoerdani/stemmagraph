/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_ADAPTER: 'mock' | 'rest' | 'supabase';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Override eksperimen perf v177-ii: paksa onlyRenderVisibleElements on/off. */
  readonly VITE_PERF_FORCE_VISIBILITY?: 'on' | 'off';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
