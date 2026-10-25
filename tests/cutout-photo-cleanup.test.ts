import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { drainPhotoDeletions } from "../src/features/records/edit";
function fixture(path = "owner/records/photo.jpg") {
  const events: string[] = [];
  const query = {
    eq: () => query,
    neq: () => query,
    order: () => query,
    limit: async () => ({
      data: [{ id: "job", storage_path: path }],
      error: null,
    }),
  };
  const client = {
    from: () => ({ select: () => query }),
    storage: {
      from: () => ({
        remove: async () => {
          events.push("remove-original");
          return { error: null };
        },
      }),
    },
    rpc: async () => {
      events.push("acknowledge");
      return { error: null };
    },
  } as unknown as SupabaseClient;
  return { client, events };
}
test("photo deletion removes the local cutout before original binary and only then acknowledges its durable job", async () => {
  const f = fixture();
  await drainPhotoDeletions(f.client, "owner", async (owner, path) => {
    assert.equal(owner, "owner");
    assert.equal(path, "owner/records/photo.jpg");
    f.events.push("remove-cutout");
  });
  assert.deepEqual(f.events, [
    "remove-cutout",
    "remove-original",
    "acknowledge",
  ]);
});
test("failed derivative cleanup preserves the durable job for retry; foreign paths never delete anything", async () => {
  const f = fixture();
  await drainPhotoDeletions(f.client, "owner", async () => {
    throw Error("local IO failure");
  });
  assert.deepEqual(f.events, []);
  const other = fixture("other/records/photo.jpg");
  await drainPhotoDeletions(other.client, "owner", async () =>
    assert.fail("foreign"),
  );
  assert.deepEqual(other.events, []);
});
