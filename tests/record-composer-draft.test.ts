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
