import assert from "node:assert/strict";
import test from "node:test";
import {
  createProviderCaptureQueue,
  parsePendingProvider,
  type PendingProvider,
} from "../src/features/auth/provider-capture";
const owner = "00000000-0000-4000-8000-000000000001",
  value: PendingProvider = {
    version: 1,
    owner,
    provider: "apple",
    refreshToken: "private-refresh",
  };
function fixture() {
  const data = new Map<string, string>();
  let active = true,
    fail = false;
  const sent: PendingProvider[] = [];
  const queue = createProviderCaptureQueue({
    read: async (o, p) => data.get(o + p) ?? null,
    write: async (v) => {
      data.set(v.owner + v.provider, JSON.stringify(v));
    },
    remove: async (o, p) => {
      data.delete(o + p);
    },
    active: async () => active,
    send: async (v) => {
      sent.push(v);
      if (fail) throw Error("offline");
    },
  });
  return {
    data,
    sent,
    queue,
    active: (v: boolean) => {
      active = v;
    },
    fail: (v: boolean) => {
      fail = v;
    },
  };
}
test("failed provider delivery preserves exact pending credential and resumes without losing it", async () => {
  const h = fixture();
  await h.queue.stage(value);
  h.fail(true);
  await assert.rejects(h.queue.resume(owner));
  assert.equal(h.data.size, 1);
  h.fail(false);
  await h.queue.resume(owner);
  assert.equal(h.data.size, 0);
  assert.deepEqual(h.sent, [value, value]);
});
test("a different signed-in account cannot send or remove another account pending capture", async () => {
  const h = fixture();
  await h.queue.stage(value);
  h.active(false);
  await h.queue.resume(owner);
  assert.equal(h.sent.length, 0);
  assert.equal(h.data.size, 1);
  await h.queue.clear("00000000-0000-4000-8000-000000000002");
  assert.equal(h.data.size, 1);
});
test("older completion cannot erase a newly staged credential and repeated successful capture is deduplicated", async () => {
  const h = fixture();
  await h.queue.stage(value);
  await h.queue.resume(owner);
  await h.queue.stage(value);
  await h.queue.resume(owner);
  assert.equal(h.sent.length, 1);
  const newer = { ...value, refreshToken: "new-refresh" };
  await h.queue.stage(newer);
  await h.queue.resume(owner);
  assert.deepEqual(h.sent, [value, newer]);
});
test("corrupt/foreign pending credentials remain stored and never reach the provider transport", async () => {
  const h = fixture();
  h.data.set(owner + "apple", JSON.stringify({ ...value, owner: "other" }));
  await assert.rejects(h.queue.resume(owner));
  assert.equal(h.sent.length, 0);
  assert.equal(h.data.size, 1);
  assert.throws(() => parsePendingProvider("null", owner, "apple"));
});

test("runtime callers cannot stage an unsupported provider even with a matching payload", () => {
  assert.throws(
    () =>
      parsePendingProvider(
        JSON.stringify({ ...value, provider: "google" }),
        owner,
        "google" as never,
      ),
    /INVALID_PROVIDER_PENDING/,
  );
});
