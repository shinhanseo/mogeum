import assert from "node:assert/strict";
import test from "node:test";
import { createRecordRequestQueue } from "../src/features/records/request-queue";
import {
  submitPending,
  type PendingRecord,
  type SavePorts,
} from "../src/features/records/pending";
import {
  submitAttachment,
  type PendingAttachment,
} from "../src/features/records/attachment";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const draft: PendingRecord = {
  version: 1,
  ownerId: "synthetic-owner",
  operationId: "first",
  input: { enteredName: "합성 기록" },
};
const receipt = {
  recordId: "synthetic-record",
  cellarEntryId: "synthetic-entry",
  revision: 1,
  replayed: false,
};
test("overlapping record attempts cannot both observe empty pending state or overwrite the first receipt", async () => {
  const queue = createRecordRequestQueue();
  const gate = deferred(),
    started = deferred();
  let disk: PendingRecord | null = null;
  let calls = 0;
  const ports: SavePorts = {
    ownerId: () => draft.ownerId,
    read: async () => disk,
    write: async (v) => {
      disk = v;
    },
    upload: async () => {},
    save: async () => {
      calls++;
      started.resolve();
      await gate.promise;
      return receipt;
    },
  };
  const first = queue.run(draft.ownerId, () => submitPending(draft, ports));
  await started.promise;
  const second = queue.run(draft.ownerId, () =>
    submitPending(
      { ...draft, operationId: "second", input: { enteredName: "다른 기록" } },
      ports,
    ),
  );
  const rejected = assert.rejects(second);
  gate.resolve();
  assert.deepEqual(await first, receipt);
  await rejected;
  assert.equal(calls, 1);
  assert.equal(disk!.operationId, "first");
  assert.deepEqual(disk!.saved, receipt);
});
test("concurrent retries of the same attachment reuse its result without duplicate upload or mutation", async () => {
  const queue = createRecordRequestQueue();
  const gate = deferred(),
    started = deferred();
  let disk: PendingAttachment | null = null,
    uploads = 0,
    mutations = 0;
  const value: PendingAttachment = {
    version: 1,
    owner: "synthetic-owner",
    recordId: "synthetic-record",
    operationId: "first",
    expectedRevision: 1,
    change: {
      kind: "photo",
      storagePath: "synthetic-owner/records/first/photo.jpg",
      width: 1,
      height: 1,
    },
    localPhoto: "synthetic-photo",
  };
  const run = () =>
    queue.run("attachment-synthetic-owner-record", () =>
      submitAttachment(value, {
        owner: () => value.owner,
        read: async () => disk,
        write: async (v) => {
          disk = v;
        },
        upload: async () => {
          uploads++;
          started.resolve();
          await gate.promise;
        },
        apply: async () => {
          mutations++;
          return receipt;
        },
      }),
    );
  const first = run();
  await started.promise;
  const second = run();
  gate.resolve();
  assert.deepEqual(await first, receipt);
  assert.deepEqual(await second, receipt);
  assert.equal(uploads, 1);
  assert.equal(mutations, 1);
});
test("completion cleanup cannot delete a subsequent operation while waiting on storage", async () => {
  const queue = createRecordRequestQueue();
  const gate = deferred(),
    started = deferred();
  let disk: PendingRecord | null = { ...draft, saved: receipt };
  const clear = queue.run(draft.ownerId, async () => {
    const original = disk;
    if (original?.operationId !== draft.operationId) return;
    started.resolve();
    await gate.promise;
    disk = null;
  });
  await started.promise;
  const next = queue.run(draft.ownerId, async () => {
    disk = { ...draft, operationId: "second" };
  });
  gate.resolve();
  await Promise.all([clear, next]);
  assert.equal(disk!.operationId, "second");
});
test("a failed owner request releases only its queue and preserves uncertain state for retry", async () => {
  const queue = createRecordRequestQueue();
  const gate = deferred(),
    started = deferred();
  let disk: PendingRecord | null = null;
  const failure = queue.run(draft.ownerId, async () => {
    disk = draft;
    started.resolve();
    await gate.promise;
    throw Error("uncertain network");
  });
  const failed = assert.rejects(failure);
  await started.promise;
  assert.equal(await queue.run("different-owner", async () => 42), 42);
  const retry = queue.run(draft.ownerId, async () => disk);
  gate.resolve();
  await failed;
  assert.deepEqual(await retry, draft);
});
