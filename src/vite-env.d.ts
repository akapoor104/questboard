/// <reference types="vite/client" />

// The only settings the app reads. All three are public by design (see docs/03-architecture.md).
interface ImportMetaEnv {
  /** https://YOUR-REF.supabase.co. Empty means demo mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** The publishable key (sb_publishable_...). Never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** '1' forces demo mode whatever else is set. The browser tests use it. */
  readonly VITE_FORCE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
