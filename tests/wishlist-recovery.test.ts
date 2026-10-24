import test from "node:test";
import assert from "node:assert/strict";
import {
  createWishlistQueue,
  decodeWishlistOperation,
  type WishlistOperation,
} from "../src/features/discovery/wishlist";
const owner = "11111111-1111-4111-8111-111111111111";
const operation = (): WishlistOperation => ({
  version: 1,
  owner,
  operationId: "22222222-2222-4222-8222-222222222222",
  productId: "glenlivet-12",
  saved: true,
  expectedRevision: 0,
});
function harness() {
  let raw: string | null = null,
    active = true,
    calls = 0,
    refreshed = 0;
  let remote = { productId: "glenlivet-12", saved: true, revision: 1 };
  const port = {
    active: () => active,
    read: async () => raw,
    write: async (_owner: string, value: string) => {
      raw = value;
    },
    remove: async () => {
      raw = null;
    },
    apply: async (_input: WishlistOperation): Promise<unknown> => {
      calls++;
      assert.ok(raw, "persist before calling server");
      return { ...remote, replayed: calls > 1 };
    },
    refresh: async (): Promise<unknown> => {
      refreshed++;
      return [remote];
    },
  };
  return {
    port,
    queue: () => createWishlistQueue(port),
    raw: () => raw,
    setRaw: (value: string) => {
      raw = value;
    },
    calls: () => calls,
    refreshed: () => refreshed,
    switch: () => {
      active = false;
    },
    remote: (value: typeof remote) => {
      remote = value;
    },
  };
}
test("response loss keeps identical operation; a new queue replays and refreshes current state", async () => {
  const h = harness(),
    original = h.port.apply;
  let first = true;
  h.port.apply = async (input) => {
    const receipt = await original(input);
    if (first) {
      first = false;
      throw new Error("connection lost after commit");
    }
    return receipt;
  };
  await assert.rejects(h.queue().submit(operation()), /connection lost/);
  assert.equal(
    decodeWishlistOperation(h.raw()!, owner).operationId,
    operation().operationId,
  );
  const recovered = await h.queue().resume(owner);
  assert.equal(recovered!.state[0].revision, 1);
  assert.equal(h.calls(), 2);
  assert.equal(h.raw(), null);
});
test("receipt survives refresh failure; recovery reads current state without reapplying old toggle", async () => {
  const h = harness(),
    refresh = h.port.refresh;
  h.port.refresh = async () => {
    throw new Error("offline");
  };
  await assert.rejects(h.queue().submit(operation()), /offline/);
  assert.ok(decodeWishlistOperation(h.raw()!, owner).receipt);
  h.remote({ productId: "glenlivet-12", saved: false, revision: 2 });
  h.port.refresh = refresh;
  const current = await h.queue().resume(owner);
  assert.equal(current!.state[0].saved, false);
  assert.equal(h.calls(), 1);
  assert.equal(h.raw(), null);
});
test("account switching stores receipt under old account but does not publish or remove it", async () => {
  const h = harness(),
    apply = h.port.apply;
  h.port.apply = async (input) => {
    const value = await apply(input);
    h.switch();
    return value;
  };
  await assert.rejects(h.queue().submit(operation()), /ACCOUNT_CHANGED/);
  assert.ok(decodeWishlistOperation(h.raw()!, owner).receipt);
  assert.equal(h.refreshed(), 0);
});
test("stale revision explicitly rejected by server refreshes without retrying or pretending saved", async () => {
  const h = harness();
  let rejected = 0;
  h.port.apply = async () => {
    rejected++;
    throw Object.assign(new Error("STALE_WISHLIST"), {
      code: "STALE_WISHLIST",
    });
  };
  h.remote({ productId: "glenlivet-12", saved: false, revision: 4 });
  const result = await h.queue().submit(operation());
  assert.equal(result.conflicted, true);
  assert.equal(result.state[0].saved, false);
  assert.equal(rejected, 1);
  assert.equal(h.raw(), null);
});
test("a pending uncertain request cannot be overwritten by a second screen", async () => {
  const h = harness(),
    queue = h.queue();
  h.port.apply = async () => {
    throw new Error("offline");
  };
  const first = queue.submit(operation()),
    second = queue.submit({
      ...operation(),
      operationId: "33333333-3333-4333-8333-333333333333",
      saved: false,
    });
  const results = await Promise.allSettled([first, second]);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "rejected");
  assert.equal(
    (results[1] as PromiseRejectedResult).reason.message,
    "WISHLIST_PENDING",
  );
  assert.equal(decodeWishlistOperation(h.raw()!, owner).saved, true);
});
test("failed persistence never performs a remote mutation and malformed receipt stays pending", async () => {
  const h = harness();
  h.port.write = async () => {
    throw new Error("disk full");
  };
  await assert.rejects(h.queue().submit(operation()), /disk full/);
  assert.equal(h.calls(), 0);
  const j = harness();
  j.port.apply = async () => ({
    productId: "glenlivet-12",
    saved: false,
    revision: 1,
    replayed: false,
  });
  await assert.rejects(j.queue().submit(operation()), /INVALID_WISHLIST/);
  assert.ok(j.raw());
  assert.equal(j.refreshed(), 0);
});
test("corrupt or foreign persisted operations are preserved; stale refresh cannot clear receipt", async () => {
  const h = harness();
  h.setRaw(JSON.stringify({ ...operation(), owner: "foreign" }));
  await assert.rejects(h.queue().resume(owner), /INVALID_WISHLIST/);
  assert.ok(h.raw());
  assert.equal(h.calls(), 0);
  const j = harness();
  j.port.refresh = async () => [];
  await assert.rejects(j.queue().submit(operation()), /REFRESH_INCONSISTENT/);
  assert.ok(decodeWishlistOperation(j.raw()!, owner).receipt);
});
