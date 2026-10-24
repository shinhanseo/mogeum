import assert from "node:assert/strict";
import test from "node:test";
import {
  createMenuStore,
  retiredMenuPhotos,
} from "../src/features/menu/storage";
import type { MenuDraft } from "../src/features/menu/device";
const owner = "synthetic-owner",
  directory = "file:///synthetic/",
  id = "90000000-0000-4000-8000-000000000001",
  pid = "90000000-0000-4000-8000-000000000002",
  other = "90000000-0000-4000-8000-000000000003";
function draft(revision = 1, account = owner): MenuDraft {
  return {
    id,
    revision: 0,
    photos: [
      {
        id: pid,
        imageRevision: revision,
        width: 100,
        height: 100,
        state: "waiting",
        ocr: null,
        uri: `${directory}menu-drafts/${account}/${id}/${pid}-${revision}.jpg`,
      },
    ],
    items: [],
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function harness(initial: MenuDraft | null = draft()) {
  const values = new Map<string, string>();
  if (initial) values.set(owner, JSON.stringify(initial));
  const deleted: string[] = [],
    written: string[] = [];
  const ports = {
    directory,
    read: async (account: string) => values.get(account) ?? null,
    write: async (account: string, raw: string) => {
      written.push(raw);
      values.set(account, raw);
    },
    list: async () => [] as string[],
    remove: async (uri: string) => {
      deleted.push(uri);
    },
  };
  return { values, deleted, written, ports };
}
test("a reopened screen reads after all previously enqueued writes, including cleanup", async () => {
  const h = harness(),
    gate = deferred(),
    started = deferred();
  let count = 0;
  const write = h.ports.write;
  h.ports.write = async (o, raw) => {
    if (count++ === 0) {
      started.resolve();
      await gate.promise;
    }
    await write(o, raw);
  };
  const store = createMenuStore(h.ports),
    first = store.save(owner, draft(2)),
    second = store.save(owner, draft(3));
  let readDone = false;
  const reopened = store.load(owner).then((r) => {
    readDone = true;
    return r;
  });
  await started.promise;
  assert.equal(readDone, false);
  assert.equal(h.written.length, 0);
  gate.resolve();
  await Promise.all([first, second]);
  const r = await reopened;
  assert.equal(r.status, "ready");
  if (r.status === "ready") assert.equal(r.draft.photos[0].imageRevision, 3);
  assert.equal(h.written.length, 2);
});
test("queued writes capture a snapshot before later in-memory edits", async () => {
  const h = harness(),
    store = createMenuStore(h.ports),
    d = draft(2),
    pending = store.save(owner, d);
  d.photos[0].imageRevision = 999;
  await pending;
  assert.equal(JSON.parse(h.values.get(owner)!).photos[0].imageRevision, 2);
});
test("future revisions and uncommitted new photos survive an earlier cleanup pass", () => {
  const old = draft(1),
    next = draft(2),
    root = `${directory}menu-drafts/${owner}/${id}/`;
  const retired = retiredMenuPhotos(owner, directory, old, next, [
    `${pid}-1.jpg`,
    `${pid}-2.jpg`,
    `${pid}-3.jpg`,
    `${other}-1.jpg`,
    "../escape.jpg",
  ]);
  assert.deepEqual(retired, [`${root}${pid}-1.jpg`]);
});
test("an ordinary metadata save cannot delete a just-prepared higher revision or unknown photo", async () => {
  const h = harness();
  h.ports.list = async () => [`${pid}-1.jpg`, `${pid}-2.jpg`, `${other}-1.jpg`];
  await createMenuStore(h.ports).save(owner, draft(1));
  assert.deepEqual(h.deleted, []);
});
test("only exact retired committed photos are removed after an explicit removal", () => {
  const old = draft(),
    next = draft();
  next.photos = [];
  assert.deepEqual(retiredMenuPhotos(owner, directory, old, next, []), [
    old.photos[0].uri,
  ]);
  const unknown = {
    ...old,
    photos: [{ ...old.photos[0], uri: "file:///unrelated/personal.jpg" }],
  };
  assert.deepEqual(retiredMenuPhotos(owner, directory, unknown, next, []), []);
});
test("cleanup failure cannot turn a successful durable write into an uncertain save", async () => {
  const h = harness();
  h.ports.remove = async () => {
    throw new Error("busy file");
  };
  const store = createMenuStore(h.ports);
  await store.save(owner, draft(2));
  const result = await store.load(owner);
  assert.equal(result.status, "ready");
  if (result.status === "ready")
    assert.equal(result.draft.photos[0].imageRevision, 2);
});
test("failed metadata commits never remove photos and do not poison the next retry", async () => {
  const h = harness(),
    write = h.ports.write;
  let fail = true;
  h.ports.write = async (o, raw) => {
    if (fail) {
      fail = false;
      throw new Error("disk full");
    }
    await write(o, raw);
  };
  const store = createMenuStore(h.ports);
  await assert.rejects(store.save(owner, draft(2)), /disk full/);
  assert.deepEqual(h.deleted, []);
  assert.equal(JSON.parse(h.values.get(owner)!).photos[0].imageRevision, 1);
  await store.save(owner, draft(2));
  assert.equal(JSON.parse(h.values.get(owner)!).photos[0].imageRevision, 2);
});
test("failure to read the prior committed metadata cannot silently overwrite it", async () => {
  const h = harness();
  h.ports.read = async () => {
    throw new Error("temporarily unavailable");
  };
  const store = createMenuStore(h.ports);
  await assert.rejects(store.save(owner, draft(2)), /unavailable/);
  assert.equal(h.written.length, 0);
  assert.equal((await store.load(owner)).status, "failed");
});
test("corrupt prior metadata remains untouched instead of becoming an empty session", async () => {
  const h = harness();
  h.values.set(owner, "{corrupt");
  await assert.rejects(createMenuStore(h.ports).save(owner, draft(2)));
  assert.equal(h.values.get(owner), "{corrupt");
  assert.deepEqual(h.deleted, []);
});
test("different account queues cannot block or overwrite one another", async () => {
  const h = harness(),
    gate = deferred(),
    started = deferred(),
    write = h.ports.write;
  h.ports.write = async (o, raw) => {
    if (o === owner) {
      started.resolve();
      await gate.promise;
    }
    await write(o, raw);
  };
  const store = createMenuStore(h.ports);
  const a = store.save(owner, draft(2));
  await started.promise;
  await store.save("other-owner", draft(1, "other-owner"));
  assert.ok(h.values.has("other-owner"));
  assert.equal(JSON.parse(h.values.get(owner)!).photos[0].imageRevision, 1);
  gate.resolve();
  await a;
});
test("a separate session cannot cause cleanup of the preceding session directory", () => {
  const old = draft(),
    next = { ...draft(), id: other, photos: [] };
  assert.deepEqual(retiredMenuPhotos(owner, directory, old, next, []), []);
});
