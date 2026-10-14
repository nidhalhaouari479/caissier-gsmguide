'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthContext, AuthUser } from './AuthContext';

const STORAGE_KEY = 'pos_odoo_session';

interface StoredSession {
  user: AuthUser;
  sessionId: string;
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid stored data
  }
  return null;
}

function storeSession(session: StoredSession | null) {
  if (typeof window === 'undefined') return;
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount, then validate it against Odoo
  useEffect(() => {
    const restoreAndValidate = async () => {
      const stored = getStoredSession();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        // Ping Odoo to verify the session is still alive
        const res = await fetch(
          `/api/odoo/session?session_id=${encodeURIComponent(stored.sessionId)}`
        );
        const data = await res.json();

        if (data.valid) {
          // Session is still valid: restore it and hydrate company names from server if missing.
          const hydratedUser: AuthUser = {
            ...stored.user,
            company_name: stored.user.company_name || data.company_name,
            company_names: stored.user.company_names || data.company_names,
          };
          setUser(hydratedUser);
          setSessionId(stored.sessionId);
        } else {
          // Session expired or invalid: clear stored data so the user is redirected to login
          console.info('Stored Odoo session has expired. Clearing session.');
          storeSession(null);
        }
      } catch (err) {
        // Network error (Odoo unreachable): restore session optimistically
        // so the user isn't logged out just because of a temporary connectivity issue.
        console.warn('Could not reach Odoo to validate session, restoring optimistically:', err);
        setUser(stored.user);
        setSessionId(stored.sessionId);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAndValidate();
  }, []);

  const login = useCallback(async (db: string, username: string, password: string) => {
    const response = await fetch('/api/odoo/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db, login: username, password }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Login failed');
    }

    const authUser: AuthUser = {
      uid: data.uid,
      username: data.username,
      name: data.name,
      company_id: data.company_id,
      company_name: data.company_name,
      company_names: data.company_names,
    };

    setUser(authUser);
    setSessionId(data.session_id);
    storeSession({ user: authUser, sessionId: data.session_id });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setSessionId(null);
    storeSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        isAuthenticated: !!user && !!sessionId,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

