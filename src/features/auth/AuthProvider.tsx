import { AppState } from "react-native";
import {
  captureExchangedSession,
  captureExistingSession,
  resumeProviderCapture,
} from "./provider-capture-device";
import { observeExchangedSession } from "./exchange";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getBackendState } from "../../lib/env";
import { getSupabase } from "../../lib/supabase";
import { observeSession, type SessionState } from "./session";
const AuthContext = createContext<SessionState>({ status: "loading" });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => ({
    status: getBackendState().configured ? "loading" : "signed-out",
  }));
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const release = observeExchangedSession(client, captureExchangedSession);
    const unsubscribe = observeSession(client, setState);
    return () => {
      release();
      unsubscribe();
    };
  }, []);
  const session = state.status === "signed-in" ? state.session : null;
  useEffect(() => {
    if (!session) return;
    void captureExistingSession(session).catch(() => {});
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active")
        void resumeProviderCapture(session.user.id).catch(() => {});
    });
    return () => subscription.remove();
  }, [session]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
