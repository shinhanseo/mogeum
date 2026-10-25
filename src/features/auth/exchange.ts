import type { Session, SupabaseClient } from "@supabase/supabase-js";
const observers = new WeakMap<
  SupabaseClient,
  (session: Session) => Promise<void>
>();
export function observeExchangedSession(
  client: SupabaseClient,
  listener: (session: Session) => Promise<void>,
) {
  observers.set(client, listener);
  return () => {
    if (observers.get(client) === listener) observers.delete(client);
  };
}
const exchanges = new WeakMap<SupabaseClient, Map<string, Promise<void>>>();
/** Native browser completion and the router may receive the same one-use code. */
export function exchangeOAuthCode(
  client: SupabaseClient,
  code: string,
): Promise<void> {
  let cache = exchanges.get(client);
  if (!cache) {
    cache = new Map();
    exchanges.set(client, cache);
  }
  const existing = cache.get(code);
  if (existing) return existing;
  const result = client.auth
    .exchangeCodeForSession(code)
    .then(async ({ data, error }) => {
      if (error)
        throw new Error("로그인 세션을 만들지 못했어요. 다시 시도해주세요.");
      if (data?.session)
        await observers
          .get(client)?.(data.session)
          .catch(() => {});
    });
  cache.set(code, result);
  if (cache.size > 10) cache.delete(cache.keys().next().value!);
  return result;
}
