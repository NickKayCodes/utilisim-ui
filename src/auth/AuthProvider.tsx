import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import type { AuthContextValue, AuthStatus, AuthUser } from './auth-context';
import { authApi } from '../services/auth';
import { archiveApi } from '../services/archive';
import {
  ApiError,
  clearSession,
  readSession,
  setUnauthorizedHandler,
  writeSession,
} from '../lib/api';

/** Read once at module load: the session survives reloads via localStorage. */
const initialSession = readSession();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(initialSession);
  const [booting, setBooting] = useState<boolean>(initialSession !== null);

  // Validate a restored token once. Any 401 clears the session; other failures
  // (backend down) keep the user signed in so the pages can show the real error.
  useEffect(() => {
    if (!readSession()) return;

    let cancelled = false;
    archiveApi
      .list()
      .then(() => {
        if (!cancelled) setBooting(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          setUser(null);
        }
        setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setBooting(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const adoptSession = useCallback((nextUser: AuthUser, token: string) => {
    writeSession(nextUser, token);
    setUser(nextUser);
    setBooting(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      adoptSession(
        {
          id: response.id,
          // `username` is the email on the wire; keep it as the server sent it.
          username: response.username,
          email: response.email,
        },
        response.token,
      );
    },
    [adoptSession],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      // Registration does not return a token, so sign in right after.
      await authApi.register({ username, email, password });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setBooting(false);
  }, []);

  const status: AuthStatus = user ? (booting ? 'loading' : 'authenticated') : 'anonymous';

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
