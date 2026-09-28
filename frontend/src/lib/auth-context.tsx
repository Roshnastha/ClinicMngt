"use client";

/**
 * Global auth state: user + tokens, login/logout actions.
 * Tokens live in localStorage; a mirror cookie lets server middleware
 * perform redirect guards before any client JS runs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearTokens,
  getAccessToken,
  setTokens,
  setUnauthorizedHandler,
  TOKEN_KEYS,
  type ApiUser,
} from "./api-client";

const COOKIE_NAME = "pd_auth";

function setAuthCookie(value: string | null): void {
  if (typeof document === "undefined") return;
  if (value) {
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  } else {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }
}

function readStoredUser(): ApiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEYS.user);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<ApiUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on first client render.
  useEffect(() => {
    const storedToken = getAccessToken();
    const storedUser = readStoredUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setAuthCookie("1");
      // Validate the stored session in the background.
      api
        .get<ApiUser>("/auth/me")
        .then((fresh) => {
          setUser(fresh);
          window.localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(fresh));
        })
        .catch(() => {
          // Token invalid and refresh failed – api-client already cleared state.
          setUser(null);
          setToken(null);
          setAuthCookie(null);
        });
    } else {
      setAuthCookie(null);
    }
    setIsLoading(false);
  }, []);

  // Global 401 handler: wipe state; middleware handles the redirect.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setToken(null);
      setAuthCookie(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      role: "ADMIN" | "STAFF";
      user: ApiUser;
    }>("/auth/login", { username: identifier, password }, { skipAuth: true });

    setTokens(data.access_token, data.refresh_token);
    window.localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(data.user));
    setAuthCookie("1");
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setAuthCookie(null);
    setUser(null);
    setToken(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      isAdmin: user?.role === "ADMIN",
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
