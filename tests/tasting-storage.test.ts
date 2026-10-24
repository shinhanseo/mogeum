import test from "node:test";
import assert from "node:assert/strict";
import { createTastingDraftStorage } from "../src/features/tasting/draft-storage";
import { newTastingDraft } from "../src/features/tasting/draft";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const draft = () =>
  newTastingDraft("synthetic-owner", "synthetic-record", "whisky", "light");
test("restore waits for a queued keystroke instead of publishing the previous draft", async () => {
  const gate = deferred(),
    started = deferred();
  let raw: string | null = null;
  const store = createTastingDraftStorage({
    getItem: async () => raw,
    setItem: async (_key, value) => {
      started.resolve();
      await gate.promise;
      raw = value;
    },
    removeItem: async () => {
      raw = null;
    },
  });
  const value = draft();
  const write = store.persist(value);
  await started.promise;
  let readFinished = false;
  const read = store.restore(value.ownerId, value.recordId).then((v) => {
    readFinished = true;
    return v;
  });
  await Promise.resolve();
  assert.equal(readFinished, false);
  gate.resolve();
  await write;
  assert.deepEqual(await read, value);
});
test("completed note cleanup never removes a newer draft and cannot overtake later edits", async () => {
  let raw: string | null = null;
  let removals = 0;
  const store = createTastingDraftStorage({
    getItem: async () => raw,
    setItem: async (_key, value) => {
      raw = value;
    },
    removeItem: async () => {
      removals++;
      raw = null;
    },
  });
  const original = draft(),
    newer = { ...original, revision: 2 };
  await store.persist(original);
  await store.persist(newer);
  assert.equal(
    await store.clear(original.ownerId, original.recordId, original),
    false,
  );
  assert.deepEqual(
    await store.restore(original.ownerId, original.recordId),
    newer,
  );
  assert.equal(removals, 0);
  const clear = store.clear(original.ownerId, original.recordId, newer);
  const edit = store.persist({ ...newer, revision: 3 });
  assert.equal(await clear, true);
  await edit;
  assert.equal(
    (await store.restore(original.ownerId, original.recordId))?.revision,
    3,
  );
});
test("empty or corrupt storage fails without rewriting it, and failed writes do not poison future restoration", async () => {
  let raw: string | null = "";
  let fail = false;
  const store = createTastingDraftStorage({
    getItem: async () => raw,
    setItem: async (_key, value) => {
      if (fail) throw Error("disk");
      raw = value;
    },
    removeItem: async () => {
      raw = null;
    },
  });
  await assert.rejects(store.restore("synthetic-owner", "synthetic-record"));
  assert.equal(raw, "");
  raw = "{";
  await assert.rejects(store.restore("synthetic-owner", "synthetic-record"));
  assert.equal(raw, "{");
  raw = null;
  assert.equal(
    await store.restore("synthetic-owner", "synthetic-record"),
    null,
  );
  fail = true;
  await assert.rejects(store.persist(draft()));
  fail = false;
  await store.persist(draft());
  assert.deepEqual(
    await store.restore("synthetic-owner", "synthetic-record"),
    draft(),
  );
});
