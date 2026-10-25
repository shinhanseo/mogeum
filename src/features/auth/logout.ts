import type { SupabaseClient } from "@supabase/supabase-js";
/** Shared by screens; duplicate taps cannot sign out a subsequent login. Drafts and server records are preserved. */
export function createLogoutAction(client: Pick<SupabaseClient, "auth">) {
  let pending: Promise<void> | null = null;
  return (owner: string): Promise<void> => {
    if (pending) return pending;
    const request = (async () => {
      const { data, error } = await client.auth.getSession();
      if (error || data.session?.user.id !== owner)
        throw new Error("ACCOUNT_CHANGED");
      const signedOut = await client.auth.signOut({ scope: "local" });
      if (signedOut.error) throw new Error("SIGNOUT_FAILED");
    })();
    pending = request;
    void request
      .finally(() => {
        if (pending === request) pending = null;
      })
      .catch(() => {});
    return request;
  };
}
const actions = new WeakMap<
  SupabaseClient,
  ReturnType<typeof createLogoutAction>
>();
export function logoutAccount(client: SupabaseClient, owner: string) {
  let action = actions.get(client);
  if (!action) {
    action = createLogoutAction(client);
    actions.set(client, action);
  }
  return action(owner);
}
