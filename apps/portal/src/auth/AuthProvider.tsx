import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { initKeycloak, keycloak, login, logout } from '@/lib/keycloak';
import type { Me } from '@/lib/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'forbidden'; username: string }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; me: Me };

interface AuthContextValue {
  state: AuthState;
  me: Me | null;
  login: (redirectPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Me['roles']) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const loadProfile = useCallback(async () => {
    try {
      const me = await api.get<Me>('/me');
      setState({ status: 'authenticated', me });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setState({ status: 'forbidden', username: keycloak.tokenParsed?.preferred_username ?? '' });
      } else {
        setState({ status: 'error', message: (error as Error).message });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    initKeycloak()
      .then((authenticated) => {
        if (cancelled) return;
        if (!authenticated) setState({ status: 'anonymous' });
        else void loadProfile();
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Le service d’identité Keycloak est injoignable. Vérifiez que la pile Docker est démarrée.',
          });
        }
      });
    keycloak.onAuthLogout = () => setState({ status: 'anonymous' });
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => setState({ status: 'anonymous' }));
    };
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const me = state.status === 'authenticated' ? state.me : null;
    return {
      state,
      me,
      login,
      logout,
      hasRole: (...roles) => !!me && (me.roles.includes('tp-admin') || roles.some((role) => me.roles.includes(role))),
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('Utilisateur non authentifié');
  return me;
}
