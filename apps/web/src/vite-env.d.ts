/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_BASE_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_LEGAL_EDITOR?: string;
  readonly VITE_LEGAL_CONTACT?: string;
}
