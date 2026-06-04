/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_BASE_URL?: string;
  readonly VITE_FLIGHT_BASE_URL?: string;
  readonly VITE_BOOKING_BASE_URL?: string;
  readonly VITE_BAGGAGE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
