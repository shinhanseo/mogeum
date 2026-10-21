import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { getBackendState } from './env';

let client: SupabaseClient | null = null;
/** No client or network request is created until valid public configuration exists. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const state = getBackendState();
  if (!state.configured) return null;
  client = createClient(state.config.url, state.config.publishableKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      storageKey: `mogeum-${new URL(state.config.url).hostname}-auth`,
      autoRefreshToken: true, persistSession: true, detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}

/** Root layout owns this subscription, including cleanup during Fast Refresh. */
export function attachAuthLifecycle() {
  const backend = getSupabase();
  if (!backend || Platform.OS === 'web') return () => {};
  const update = (state: string | null | undefined) => {
    if (state === 'active') backend.auth.startAutoRefresh();
    else backend.auth.stopAutoRefresh();
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener('change', update);
  return () => { subscription.remove(); backend.auth.stopAutoRefresh(); };
}
