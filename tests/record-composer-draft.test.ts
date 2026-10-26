import assert from "node:assert/strict";
import test from "node:test";
import {
  createComposerDraftStorage,
  composerContext,
  composerPhotoUri,
  parseComposerDraft,
  type RecordComposerDraft,
} from "../src/features/records/composer-draft";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const draft = (): RecordComposerDraft => ({
  version: 1,
  ownerId: owner,
  context: "new",
  id: "33333333-3333-4333-8333-333333333333",
  revision: 1,
  step: "info",
  name: "와인 초안",
  category: "wine",
  feeling: null,
  stars: 0,
  consumedAt: "2026-10-26T03:00:00.000Z",
  vintageMode: "year",
  vintageYear: "20",
  vintage: "",
  entryId: null,
  separateName: null,
  photo: null,
});
function memory() {
  const rows = new Map<string, string>();
  return {
    rows,
    store: createComposerDraftStorage({
      getItem: async (k) => rows.get(k) ?? null,
      setItem: async (k, v) => {
        rows.set(k, v);
      },
      removeItem: async (k) => {
        rows.delete(k);
      },
    }),
  };
}
test("unfinished wine input survives restore without crossing accounts or entry/prefill contexts", async () => {
  const { store } = memory();
  const value = draft();
  await store.persist(value);
  assert.deepEqual(await store.restore(owner, "new"), value);
  assert.equal(await store.restore(other, "new"), null);
  assert.equal(await store.restore(owner, composerContext(owner)), null);
  assert.equal(
    await store.restore(owner, composerContext(undefined, "glenlivet-12")),
    null,
  );
  assert.throws(() => parseComposerDraft(JSON.stringify(value), other, "new"));
});
test("stale writes and cleanup cannot destroy a newer draft; completed drafts cannot resurrect", async () => {
  const { store } = memory(),
    old = draft(),
    newer = { ...old, revision: 2, name: "나중에 쓴 이름" };
  await store.persist(old);
  await store.persist(newer);
  await assert.rejects(store.persist(old), /CONFLICT/);
  assert.equal(await store.finish(old), false);
  assert.deepEqual(await store.restore(owner, "new"), newer);
  assert.equal(await store.finish(newer), true);
  await assert.rejects(store.persist(newer), /CLOSED/);
  assert.equal(await store.restore(owner, "new"), null);
  await store.persist({ ...old, id: other });
});
test("corrupt input cannot authorize a photo path or overwrite a different form", async () => {
  const { store, rows } = memory(),
    value = draft();
  await store.persist(value);
  await assert.rejects(store.persist({ ...value, id: other }), /CONFLICT/);
  assert.throws(() =>
    composerPhotoUri("file:///docs/", owner, "../../outside"),
  );
  assert.equal(
    composerPhotoUri("file:///new-container/", owner, other),
    `file:///new-container/record-composer-drafts/${owner}/${other}.jpg`,
  );
  const raw = JSON.stringify({
    ...value,
    photo: { id: "../other", width: 100, height: 100 },
  });
  assert.throws(() => parseComposerDraft(raw, owner, "new"));
  const key = [...rows.keys()][0];
  rows.set(key, "broken");
  await assert.rejects(store.restore(owner, "new"));
  assert.equal(rows.get(key), "broken");
});

test("composer keys participate in account deletion freeze and only the selected owner cleanup", async () => {
  const { composerStorageKey } =
    await import("../src/features/records/composer-draft");
  const { deletedAccountKeys } =
    await import("../src/features/auth/deletion-local");
  const { createAccountStorage } =
    await import("../src/features/auth/account-storage-core");
  const a = composerStorageKey(owner, "new"),
    b = composerStorageKey(other, "new");
  assert.deepEqual(
    deletedAccountKeys(owner, [
      a,
      b,
      "mogeum:record-composer:v1:" + owner + "-other:new",
    ]),
    [a],
  );
  let writes = 0;
  const storage = createAccountStorage({
    getItem: async () => null,
    setItem: async () => {
      writes++;
    },
    removeItem: async () => {},
  });
  await storage.freeze(owner);
  await assert.rejects(storage.setItem(a, "new draft"), /ACCOUNT_DELETING/);
  await storage.setItem(b, "different owner's draft");
  assert.equal(writes, 1);
});

test("file cleanup failure keeps the exact draft for safe receipt retry", async () => {
  const { store } = memory(),
    value = draft();
  await store.persist(value);
  await assert.rejects(
    store.finish(value, async () => {
      throw Error("file busy");
    }),
    /file busy/,
  );
  assert.deepEqual(await store.restore(owner, "new"), value);
  let cleanup = 0;
  assert.equal(
    await store.finish(value, async () => {
      cleanup++;
    }),
    true,
  );
  assert.equal(cleanup, 1);
  assert.equal(await store.restore(owner, "new"), null);
});
test("pending requests preserve validated source draft and reject replacing it after upload uncertainty", async () => {
  const { decodePendingRecord } =
    await import("../src/features/records/pending-restore");
  const { submitPending } = await import("../src/features/records/pending");
  const value = draft();
  const pending = {
    version: 1 as const,
    ownerId: owner,
    operationId: other,
    input: { enteredName: "사진 없는 와인" },
    composerDraft: value,
  };
  const restored = decodePendingRecord(
    JSON.stringify(pending),
    owner,
    "file:///new-container/",
  );
  assert.deepEqual(restored.composerDraft, value);
  assert.throws(() =>
    decodePendingRecord(
      JSON.stringify({
        ...pending,
        composerDraft: { ...value, ownerId: other },
      }),
      owner,
      "file:///new-container/",
    ),
  );
  let mutations = 0;
  await assert.rejects(
    submitPending(
      {
        ...pending,
        composerDraft: { ...value, revision: 2, name: "바뀐 초안" },
      },
      {
        ownerId: () => owner,
        read: async () => restored,
        write: async () => {},
        upload: async () => {},
        save: async () => {
          mutations++;
          throw Error("unexpected save");
        },
      },
    ),
    /원래 초안/,
  );
  assert.equal(mutations, 0);
});

test("finishing a recovered pending cleans only its source context, preserving another context and owner", async () => {
  const { store } = memory();
  const source = {
    ...draft(),
    context: composerContext(owner),
    entryId: owner,
  };
  const fresh = draft();
  const recommendation = {
    ...draft(),
    context: composerContext(undefined, "glenlivet-12"),
    id: other,
  };
  const anotherOwner = { ...draft(), ownerId: other };
  await Promise.all(
    [source, fresh, recommendation, anotherOwner].map((value) =>
      store.persist(value),
    ),
  );
  let removedPhoto = 0;
  assert.equal(
    await store.finish(source, async () => {
      removedPhoto++;
    }),
    true,
  );
  assert.equal(removedPhoto, 1);
  assert.equal(await store.restore(owner, source.context), null);
  assert.deepEqual(await store.restore(owner, "new"), fresh);
  assert.deepEqual(
    await store.restore(owner, recommendation.context),
    recommendation,
  );
  assert.deepEqual(await store.restore(other, "new"), anotherOwner);
});

test("failed replacement write preserves the last durable photo snapshot and queue remains usable", async () => {
  const rows = new Map<string, string>();
  let failWrite = false;
  const store = createComposerDraftStorage({
    getItem: async (key) => rows.get(key) ?? null,
    setItem: async (key, raw) => {
      if (failWrite) throw Error("disk full");
      rows.set(key, raw);
    },
    removeItem: async (key) => {
      rows.delete(key);
    },
  });
  const old = { ...draft(), photo: { id: owner, width: 600, height: 800 } };
  const replacement = {
    ...old,
    revision: 2,
    photo: { id: other, width: 900, height: 1200 },
  };
  await store.persist(old);
  failWrite = true;
  await assert.rejects(store.persist(replacement), /disk full/);
  assert.deepEqual(await store.restore(owner, "new"), old);
  // Cleanup from the failed attempt must not touch the original metadata/photo.
  let cleanup = 0;
  assert.equal(
    await store.finish(replacement, async () => {
      cleanup++;
    }),
    false,
  );
  assert.equal(cleanup, 0);
  failWrite = false;
  await store.persist(replacement);
  assert.deepEqual(await store.restore(owner, "new"), replacement);
});
