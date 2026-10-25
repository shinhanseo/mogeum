import assert from "node:assert/strict";
import test from "node:test";
import { createLogoutAction } from "../src/features/auth/logout";
import type { SupabaseClient } from "@supabase/supabase-js";
function client(auth: unknown) {
  return { auth } as Pick<SupabaseClient, "auth">;
}
test("logout ends only this device session and duplicate requests share one result", async () => {
  let finish!: () => void,
    calls = 0;
  const wait = new Promise<void>((r) => {
    finish = r;
  });
  const logout = createLogoutAction(
    client({
      getSession: async () => ({
        data: { session: { user: { id: "owner" } } },
        error: null,
      }),
      signOut: async (options: unknown) => {
        calls++;
        assert.deepEqual(options, { scope: "local" });
        await wait;
        return { error: null };
      },
    }),
  );
  const first = logout("owner"),
    second = logout("owner");
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  await first;
});
test("an account change prevents logout of the newly active account", async () => {
  let calls = 0;
  const logout = createLogoutAction(
    client({
      getSession: async () => ({
        data: { session: { user: { id: "other" } } },
        error: null,
      }),
      signOut: async () => {
        calls++;
      },
    }),
  );
  await assert.rejects(logout("owner"), /ACCOUNT_CHANGED/);
  assert.equal(calls, 0);
});
test("a failed logout is visible and does not prevent a retry; no draft/data mutation ports exist", async () => {
  let calls = 0;
  const logout = createLogoutAction(
    client({
      getSession: async () => ({
        data: { session: { user: { id: "owner" } } },
        error: null,
      }),
      signOut: async () => ({
        error: ++calls === 1 ? new Error("offline") : null,
      }),
    }),
  );
  await assert.rejects(logout("owner"), /SIGNOUT_FAILED/);
  await logout("owner");
  assert.equal(calls, 2);
});
