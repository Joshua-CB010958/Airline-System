import axios from "axios";
import { serviceBaseUrls } from "./apiClients";
import type { ServiceHealth, ServiceKey } from "@/types";

// Lightweight, auth-free clients dedicated to health probing. The public probe
// endpoints differ per service: the auth service exposes GET /health while the
// flight/booking/baggage services expose GET /.
const probe = axios.create({ timeout: 4000 });

interface ProbeTarget {
  key: ServiceKey;
  name: string;
  port: number;
  baseURL: string;
  path: string;
}

const targets: ProbeTarget[] = [
  { key: "auth", name: "Auth Service", port: 8003, baseURL: serviceBaseUrls.auth, path: "/health" },
  { key: "flight", name: "Flight Service", port: 8000, baseURL: serviceBaseUrls.flight, path: "/" },
  { key: "booking", name: "Booking Service", port: 8001, baseURL: serviceBaseUrls.booking, path: "/" },
  { key: "baggage", name: "Baggage Service", port: 8002, baseURL: serviceBaseUrls.baggage, path: "/" },
];

async function probeOne(target: ProbeTarget): Promise<ServiceHealth> {
  const started = performance.now();
  try {
    const { data } = await probe.get(`${target.baseURL}${target.path}`);
    return {
      key: target.key,
      name: target.name,
      port: target.port,
      state: "online",
      latencyMs: Math.round(performance.now() - started),
      detail: typeof data === "object" ? data : undefined,
    };
  } catch {
    return {
      key: target.key,
      name: target.name,
      port: target.port,
      state: "offline",
      latencyMs: null,
    };
  }
}

export const healthService = {
  /** Probe every service in parallel and return their live health. */
  async probeAll(): Promise<ServiceHealth[]> {
    return Promise.all(targets.map(probeOne));
  },
};
