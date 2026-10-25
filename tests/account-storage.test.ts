import assert from "node:assert/strict";
import test from "node:test";
import { createAccountStorage } from "../src/features/auth/account-storage-core";
import {
  deletedAccountKeys,
  deletionReceiptKey,
} from "../src/features/auth/deletion-local";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
test("deletion cleanup selects only exact owner data, never auth/receipt/another account", () => {
  const key = `mogeum-pending-v1-${a}`,
    keys = [
      key,
      `mogeum:menu:v1:${a}`,
      `mogeum-tasting-v1-${a}-${b}`,
      `mogeum-pending-v1-${b}`,
      deletionReceiptKey(a),
      "sb-project-auth-token",
      `mogeum:menu:v1:${a}suffix`,
    ];
  assert.deepEqual(deletedAccountKeys(a, keys), keys.slice(0, 3));
  assert.throws(() => deletedAccountKeys("-".repeat(36), keys));
});
test("freeze waits for already started writes and rejects delayed writes without blocking another account", async () => {
  const data = new Map<string, string>();
  let finish!: () => void, started!: () => void;
  const entered = new Promise<void>((r) => {
      started = r;
    }),
    release = new Promise<void>((r) => {
      finish = r;
    });
  const store = createAccountStorage({
    getItem: async (k) => data.get(k) ?? null,
    removeItem: async (k) => {
      data.delete(k);
    },
    setItem: async (k, v) => {
      if (k === `mogeum:menu:v1:${a}`) {
        started();
        await release;
      }
      data.set(k, v);
    },
  });
  const write = store.setItem(`mogeum:menu:v1:${a}`, "old");
  await entered;
  let drained = false;
  const freeze = store.freeze(a).then(() => {
    drained = true;
  });
  await Promise.resolve();
  assert.equal(drained, false);
  finish();
  await write;
  await freeze;
  data.delete(`mogeum:menu:v1:${a}`);
  await assert.rejects(
    store.setItem(`mogeum:menu:v1:${a}`, "late"),
    /ACCOUNT_DELETING/,
  );
  await store.setItem(`mogeum:menu:v1:${b}`, "safe");
  assert.equal(data.get(`mogeum:menu:v1:${b}`), "safe");
  assert.equal(data.has(`mogeum:menu:v1:${a}`), false);
});
test("a receipt persisted before an app restart blocks subsequent owner writes", async () => {
  const store = createAccountStorage({
    getItem: async (k) => (k === deletionReceiptKey(a) ? "pending" : null),
    removeItem: async () => {},
    setItem: async () => {
      throw Error("must not write");
    },
  });
  await assert.rejects(
    store.setItem(`mogeum-pending-v1-${a}`, "draft"),
    /ACCOUNT_DELETING/,
  );
});

test("deletion waits for an in-flight menu preparation to discard its files and blocks later preparation", async () => {
  const { createPhotoPreparationQueue } =
    await import("../src/features/menu/preparation");
  const queue = createPhotoPreparationQueue();
  let prepared!: () => void, finish!: () => void;
  const entered = new Promise<void>((r) => {
      prepared = r;
    }),
    release = new Promise<void>((r) => {
      finish = r;
    });
  const discarded: string[] = [];
  const work = queue.run(a, {
    count: 1,
    active: () => true,
    prepare: async () => {
      prepared();
      await release;
      return "owner-photo";
    },
    commit: () => {
      assert.fail("deleted account must not commit prepared photo");
    },
    discard: async (photo) => {
      discarded.push(photo);
    },
  });
  await entered;
  const freeze = queue.freeze(a);
  finish();
  assert.equal(await work, null);
  await freeze;
  assert.deepEqual(discarded, ["owner-photo"]);
  await assert.rejects(
    queue.run(a, {
      count: 1,
      active: () => true,
      prepare: async () => {
        assert.fail("must not prepare");
      },
      commit: () => {},
      discard: async () => {},
    }),
    /ACCOUNT_DELETING/,
  );
});
