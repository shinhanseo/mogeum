import type { SupabaseClient } from '@supabase/supabase-js';
const exchanges = new WeakMap<SupabaseClient, Map<string, Promise<void>>>();
/** Native browser completion and the router may receive the same one-use code. */
export function exchangeOAuthCode(client: SupabaseClient, code: string): Promise<void> {
  let cache = exchanges.get(client);
  if (!cache) { cache = new Map(); exchanges.set(client, cache); }
  const existing = cache.get(code);
  if (existing) return existing;
  const result = client.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) throw new Error('로그인 세션을 만들지 못했어요. 다시 시도해주세요.');
  });
  cache.set(code, result);
  if (cache.size > 10) cache.delete(cache.keys().next().value!);
  return result;
}
