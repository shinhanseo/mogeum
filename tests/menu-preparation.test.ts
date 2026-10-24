import assert from "node:assert/strict";
import test from "node:test";
import { createPhotoPreparationQueue } from "../src/features/menu/preparation";
function gate<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
test("cancellation after a native copy retires only the uncommitted photo before a remount can reuse the path", async () => {
  const queue = createPhotoPreparationQueue(),
    copy = gate<string>(),
    cleaning = gate<void>();
  const started = gate<void>(),
    cleanupStarted = gate<void>();
  const events: string[] = [];
  let active = true;
  const old = queue.run("owner", {
    count: 2,
    active: () => active,
    prepare: async () => {
      started.resolve();
      return copy.promise;
    },
    commit: () => {
      throw new Error("CANCELLED_BATCH_MUST_NOT_COMMIT");
    },
    discard: async (photo) => {
      events.push(`discard:${photo}`);
      cleanupStarted.resolve();
      await cleaning.promise;
    },
  });
  await started.promise;
  active = false;
  const reopened = queue.run("owner", {
    count: 1,
    active: () => true,
    prepare: async () => {
      events.push("new-copy:revision2");
      return "revision2";
    },
    commit: (photos) => {
      events.push(`commit:${photos[0]}`);
    },
    discard: async () => {},
  });
  copy.resolve("revision2");
  await cleanupStarted.promise;
  assert.deepEqual(events, ["discard:revision2"]);
  cleaning.resolve();
  assert.equal(await old, null);
  assert.deepEqual(await reopened, ["revision2"]);
  assert.deepEqual(events, [
    "discard:revision2",
    "new-copy:revision2",
    "commit:revision2",
  ]);
});
test("partial preparation failure preserves old committed photos and cleans all prepared new photos", async () => {
  const queue = createPhotoPreparationQueue(),
    removed: string[] = [];
  const files = new Set(["original-revision1", "other-original"]);
  await assert.rejects(
    queue.run("owner", {
      count: 3,
      active: () => true,
      prepare: async (index) => {
        if (index === 2) throw new Error("IMAGE_FAILED");
        const photo = `new-${index}`;
        files.add(photo);
        return photo;
      },
      commit: () => assert.fail("incomplete batch must not be committed"),
      discard: async (photo) => {
        removed.push(photo);
        files.delete(photo);
      },
    }),
    /IMAGE_FAILED/,
  );
  assert.deepEqual(removed, ["new-0", "new-1"]);
  assert.deepEqual([...files], ["original-revision1", "other-original"]);
});
test("a committed batch survives later cancellation and cleanup failures do not block the next account operation", async () => {
  const queue = createPhotoPreparationQueue();
  let active = true,
    removed = 0;
  assert.deepEqual(
    await queue.run("owner", {
      count: 1,
      active: () => active,
      prepare: async () => "committed",
      commit: () => {
        active = false;
      },
      discard: async () => {
        removed++;
      },
    }),
    ["committed"],
  );
  assert.equal(removed, 0);
  active = true;
  assert.equal(
    await queue.run("owner", {
      count: 1,
      active: () => active,
      prepare: async () => {
        active = false;
        return "uncommitted";
      },
      commit: () => assert.fail(),
      discard: async () => {
        throw new Error("CLEANUP_FAILED");
      },
    }),
    null,
  );
  let committed = false;
  await queue.run("owner", {
    count: 1,
    active: () => true,
    prepare: async () => "next",
    commit: () => {
      committed = true;
    },
    discard: async () => {},
  });
  assert.equal(committed, true);
});
test("different account preparation is independent and cancelled queued work never starts a native copy", async () => {
  const queue = createPhotoPreparationQueue(),
    copy = gate<string>(),
    started = gate<void>();
  const first = queue.run("a", {
    count: 1,
    active: () => true,
    prepare: async () => {
      started.resolve();
      return copy.promise;
    },
    commit: () => {},
    discard: async () => {},
  });
  await started.promise;
  assert.deepEqual(
    await queue.run("b", {
      count: 1,
      active: () => true,
      prepare: async () => "b",
      commit: () => {},
      discard: async () => {},
    }),
    ["b"],
  );
  const cancelled = queue.run("a", {
    count: 1,
    active: () => false,
    prepare: async () => {
      assert.fail("inactive copy must not start");
    },
    commit: () => assert.fail(),
    discard: async () => {},
  });
  copy.resolve("a");
  await first;
  assert.equal(await cancelled, null);
});
