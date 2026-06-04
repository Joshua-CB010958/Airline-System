import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  setUnauthorizedHandler,
  tokenStore,
} from "@/services/apiClients";
import { authService } from "@/services/auth.service";
import { decodeJwt, isTokenExpired } from "@/lib/jwt";
import type { Role, UserProfile } from "@/types";

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  role: Role | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** True if the current user's role is in the allowed list. */
  hasRole: (allowed: Role[]) => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const existing = tokenStore.get();
    if (existing && isTokenExpired(existing)) {
      tokenStore.clear();
      return null;
    }
    return existing;
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(!!token);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  // Wire the Axios 401 handler to a hard logout so an expired session anywhere
  // in the app cleanly bounces the user back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  // Hydrate the profile whenever we hold a valid token.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!token) {
        setIsInitializing(false);
        return;
      }
      if (isTokenExpired(token)) {
        logout();
        setIsInitializing(false);
        return;
      }
      try {
        const profile = await authService.me();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  // Proactively expire the session client-side when the token's exp passes.
  useEffect(() => {
    if (!token) return;
    const claims = decodeJwt(token);
    if (!claims?.exp) return;
    const ms = claims.exp * 1000 - Date.now();
    if (ms <= 0) {
      logout();
      return;
    }
    const timer = window.setTimeout(logout, ms);
    return () => window.clearTimeout(timer);
  }, [token, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await authService.login(username, password);
    tokenStore.set(access_token);
    setIsInitializing(true);
    setToken(access_token);
    // Eagerly hydrate so the redirect lands on a fully-populated dashboard.
    try {
      const profile = await authService.me();
      setUser(profile);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const role = useMemo<Role | null>(() => {
    if (user) return user.role;
    if (token) return decodeJwt(token)?.role ?? null;
    return null;
  }, [user, token]);

  const hasRole = useCallback(
    (allowed: Role[]) => (role ? allowed.includes(role) : false),
    [role]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      role,
      isAuthenticated: !!token,
      isInitializing,
      login,
      logout,
      hasRole,
    }),
    [token, user, role, isInitializing, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
