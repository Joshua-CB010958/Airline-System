import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// API layer.
//
// Each microservice gets its own Axios instance with a distinct baseURL. A
// shared request interceptor attaches the JWT, and a shared response
// interceptor normalises errors and reacts to 401 (expired/invalid session).
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = "dams.token";

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
};

/** Called by the auth layer when a 401 is observed, to force a logout. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const baseUrls = {
  auth: import.meta.env.VITE_AUTH_BASE_URL ?? "/api/auth",
  flight: import.meta.env.VITE_FLIGHT_BASE_URL ?? "/api/flight",
  booking: import.meta.env.VITE_BOOKING_BASE_URL ?? "/api/booking",
  baggage: import.meta.env.VITE_BAGGAGE_BASE_URL ?? "/api/baggage",
};

/** A friendly, user-presentable error with the original status preserved. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function attachInterceptors(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
      const status = error.response?.status;

      // Session no longer valid — surface to the auth layer for a clean logout.
      if (status === 401 && onUnauthorized) {
        onUnauthorized();
      }

      const detail = error.response?.data?.detail;
      let message: string;
      if (Array.isArray(detail)) {
        message = detail.map((d) => d.msg).join(", ");
      } else if (typeof detail === "string") {
        message = detail;
      } else {
        message = mapStatusToMessage(status, error.message);
      }

      return Promise.reject(new ApiError(message, status));
    }
  );

  return instance;
}

function mapStatusToMessage(status: number | undefined, fallback: string) {
  switch (status) {
    case 400:
      return "The request was invalid.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "Access denied: your role does not permit this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "Conflict: the resource cannot be modified in its current state.";
    case 422:
      return "Validation failed. Please check the submitted fields.";
    case 503:
      return "Service unavailable. A required service is offline.";
    case 504:
      return "A downstream service timed out.";
    default:
      return fallback || "An unexpected network error occurred.";
  }
}

export const authApi = attachInterceptors(
  axios.create({ baseURL: baseUrls.auth, timeout: 10_000 })
);
export const flightApi = attachInterceptors(
  axios.create({ baseURL: baseUrls.flight, timeout: 10_000 })
);
export const bookingApi = attachInterceptors(
  axios.create({ baseURL: baseUrls.booking, timeout: 10_000 })
);
export const baggageApi = attachInterceptors(
  axios.create({ baseURL: baseUrls.baggage, timeout: 10_000 })
);

export const serviceBaseUrls = baseUrls;
