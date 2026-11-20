import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AdminUser {
  username: string;
  displayName: string;
  role: string;
  csrfToken: string;
}

interface AdminAuthContextValue {
  loading: boolean;
  setupRequired: boolean;
  authenticated: boolean;
  admin: AdminUser | null;
  refreshStatus: () => Promise<void>;
  setAuthenticatedAdmin: (admin: AdminUser) => void;
  logout: () => Promise<void>;
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/status', { credentials: 'include' });
      if (!res.ok) {
        setAdmin(null);
        return;
      }
      const data = (await res.json()) as {
        setupRequired: boolean;
        authenticated: boolean;
        admin?: AdminUser;
      };
      setSetupRequired(Boolean(data.setupRequired));
      setAdmin(data.authenticated && data.admin ? data.admin : null);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const setAuthenticatedAdmin = useCallback((nextAdmin: AdminUser) => {
    setSetupRequired(false);
    setAdmin(nextAdmin);
    setLoading(false);
  }, []);

  const adminFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers ?? {});
      const method = (init.method ?? 'GET').toUpperCase();
      if (admin?.csrfToken && method !== 'GET' && method !== 'HEAD') {
        headers.set('X-CSRF-Token', admin.csrfToken);
      }
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (res.status === 401) {
        setAdmin(null);
      }
      return res;
    },
    [admin?.csrfToken]
  );

  const logout = useCallback(async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setAdmin(null);
    }
  }, [adminFetch]);

  return (
    <AdminAuthContext.Provider
      value={{
        loading,
        setupRequired,
        authenticated: Boolean(admin),
        admin,
        refreshStatus,
        setAuthenticatedAdmin,
        logout,
        adminFetch,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
