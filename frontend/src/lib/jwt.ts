import type { JwtClaims } from "@/types";

/**
 * Decode a JWT payload client-side WITHOUT verifying its signature.
 *
 * This is used purely to read the `role`/`sub`/`exp` claims so the UI can render
 * the correct navigation and role-gated controls. Authorization is still
 * enforced server-side by every microservice — the client decode is a UX
 * convenience only and is never trusted for security decisions.
 */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // base64url -> base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** True if the token is missing or its `exp` claim is in the past. */
export function isTokenExpired(token: string): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return true;
  return claims.exp * 1000 <= Date.now();
}

/** Milliseconds remaining until expiry (0 if already expired/invalid). */
export function timeUntilExpiry(token: string): number {
  const claims = decodeJwt(token);
  if (!claims?.exp) return 0;
  return Math.max(0, claims.exp * 1000 - Date.now());
}
