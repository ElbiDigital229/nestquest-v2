import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  phone?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Returns true if the current user has the given permission key.
   *  PROPERTY_MANAGER always returns true. Other roles always return false. */
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          name: data.profile?.fullName || data.user.email,
          phone: data.user.phone,
          permissions: data.profile?.permissions ?? [],
        };
        setUser(authUser);
        localStorage.setItem("nestquest_auth_user", JSON.stringify(authUser));
      } else {
        setUser(null);
        localStorage.removeItem("nestquest_auth_user");
      }
    } catch {
      setUser(null);
      localStorage.removeItem("nestquest_auth_user");
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("nestquest_auth_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }

    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback((user: AuthUser) => {
    setUser(user);
    localStorage.setItem("nestquest_auth_user", JSON.stringify(user));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
    localStorage.removeItem("nestquest_auth_user");
  }, []);

  const hasPermission = useCallback((key: string): boolean => {
    if (!user) return false;
    if (user.role === "PROPERTY_MANAGER" || user.role === "SUPER_ADMIN") return true;
    if (user.role === "PM_TEAM_MEMBER") return (user.permissions ?? []).includes(key);
    return false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
