// ─────────────────────────────────────────────────────────────────────────────
// Shared domain types for the Distributed Airline Management System (DAMS).
// These mirror the response schemas documented in Docs/api-specification.md.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "passenger" | "staff" | "admin";

/** Claims encoded in the auth-service JWT (HS256). */
export interface JwtClaims {
  sub: string;
  role: Role;
  exp: number;
}

/** Token issued by POST /login. */
export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/** Profile returned by GET /me. */
export interface UserProfile {
  username: string;
  role: Role;
  full_name: string;
  email: string;
}

/** A flight record from the Flight Service. */
export interface Flight {
  id: number;
  flight_number: string;
  origin: string;
  destination: string;
  available_seats: number;
  status: string;
}

export type SeatClass = "economy" | "business" | "first";

/** A booking record from the Booking Service (Aurora PostgreSQL). */
export interface Booking {
  id: string;
  flight_id: string;
  passenger_name: string;
  passenger_email: string;
  seat_class: SeatClass | string;
  status: string;
  created_at: string;
}

/** Payload for POST /booking. */
export interface CreateBookingInput {
  flight_id: string;
  passenger_name: string;
  passenger_email: string;
  seat_class: SeatClass;
}

/** A baggage record from the Baggage Service (DynamoDB). */
export interface Baggage {
  id: number;
  passenger_name: string;
  flight_id: number;
  status: string;
  location: string;
}

/** Payload for POST /baggage (staff/admin). The id is generated server-side. */
export interface CreateBaggageInput {
  passenger_name: string;
  flight_id: number;
  status: string;
  location: string;
}

/** Payload for PATCH /baggage/update. */
export interface UpdateBaggageInput {
  baggage_id: number;
  status: string;
  location?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture / health monitoring model
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceKey = "auth" | "flight" | "booking" | "baggage";

export type HealthState = "online" | "offline" | "checking";

/** Live health probe result for a single microservice. */
export interface ServiceHealth {
  key: ServiceKey;
  name: string;
  port: number;
  state: HealthState;
  latencyMs: number | null;
  detail?: Record<string, unknown>;
}

/** A node in the architecture topology diagram. */
export interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: "client" | "service" | "datastore" | "messaging" | "compute";
  /** Linked live-health service, if this node maps to a probed service. */
  service?: ServiceKey;
}
