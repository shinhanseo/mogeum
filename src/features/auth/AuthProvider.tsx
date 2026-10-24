import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getBackendState } from '../../lib/env';
import { getSupabase } from '../../lib/supabase';
import { observeSession, type SessionState } from './session';
const AuthContext = createContext<SessionState>({ status: 'loading' });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => ({ status:getBackendState().configured ? 'loading' : 'signed-out' }));
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    return observeSession(client, setState);
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
