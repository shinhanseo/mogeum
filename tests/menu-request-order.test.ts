import assert from "node:assert/strict";
import test from "node:test";
import { createMenuRequestQueue } from "../src/features/menu/request-queue";
import { createMenuStore } from "../src/features/menu/storage";
import { submitMenu } from "../src/features/menu/submission";
import type { MenuDraft } from "../src/features/menu/device";
import {
  parseMenu,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
const owner = "synthetic-menu-owner",
  directory = "file:///synthetic/";
const id = "90000000-0000-4000-8000-000000000001";
const p: MenuPhoto = {
  id,
  imageRevision: 1,
  width: 1200,
  height: 1600,
  engine: "apple-vision-v1",
  lines: [
    {
      id: `${id}:1:0`,
      text: "글렌리벳 12년 15000원",
      confidence: 0.9,
      polygon: [
        { x: 0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.15 },
        { x: 0.1, y: 0.15 },
      ],
    },
  ],
};
function fixture(): MenuDraft {
  return {
    id,
    revision: 0,
    photos: [
      {
        id,
        imageRevision: 1,
        width: 1200,
        height: 1600,
        state: "ready",
        ocr: p,
        uri: `${directory}menu-drafts/${owner}/${id}/${id}-1.jpg`,
      },
    ],
    items: parseMenu([p]).map((i) => ({ ...i, confirmed: true })),
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function harness() {
  let raw = JSON.stringify(fixture());
  const store = createMenuStore({
    directory,
    read: async () => raw,
    write: async (_, value) => {
      raw = value;
    },
    list: async () => [],
    remove: async () => {},
  });
  return { store, raw: () => raw };
}

test("reopened menu waits for the old remote response and durable revision; newer corrections survive", async () => {
  const h = harness(),
    queue = createMenuRequestQueue(),
    started = deferred(),
    release = deferred(),
    receiptStarted = deferred(),
    receiptRelease = deferred();
  let writes = 0;
  let current = fixture(),
    active = true;
  const old = queue.run(owner, () =>
    submitMenu([p], {
      read: () => current,
      write: async (d) => {
        current = d;
        if (++writes === 2) {
          receiptStarted.resolve();
          await receiptRelease.promise;
        }
        await h.store.save(owner, d);
      },
      active: () => active,
      save: async () => {
        started.resolve();
        await release.promise;
        return 1;
      },
    }),
  );
  await started.promise;
  // User edits after cancel, then closes the old screen before the server acknowledges it.
  active = false;
  current = {
    ...current,
    items: current.items.map((i) => ({
      ...i,
      name: "직접 수정한 메뉴",
      productId: null,
      price: 21000,
    })),
  };
  await h.store.save(owner, current);
  let loaded = false;
  const reopen = queue
    .run(owner, () => h.store.load(owner))
    .then((r) => {
      loaded = true;
      return r;
    });
  await queue.run("another-owner", async () => {});
  assert.equal(loaded, false);
  release.resolve();
  await receiptStarted.promise;
  assert.equal(loaded, false);
  receiptRelease.resolve();
  assert.equal(await old, null);
  const result = await reopen;
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("restore failed");
  assert.equal(result.draft.revision, 1);
  assert.equal(result.draft.pendingSave, undefined);
  assert.equal(result.draft.items[0].name, "직접 수정한 메뉴");
  assert.equal(result.draft.items[0].price, 21000);
  let newer = result.draft;
  const revisions: number[] = [];
  await queue.run(owner, () =>
    submitMenu([p], {
      read: () => newer,
      write: async (d) => {
        newer = d;
        await h.store.save(owner, d);
      },
      active: () => true,
      save: async (d) => {
        revisions.push(d.revision);
        assert.equal(d.items[0].name, "직접 수정한 메뉴");
        return 2;
      },
    }),
  );
  assert.deepEqual(revisions, [1]);
  assert.equal(JSON.parse(h.raw()).revision, 2);
});

test("failed old response keeps the exact replay payload and does not poison reopening or the next save", async () => {
  const h = harness(),
    queue = createMenuRequestQueue(),
    started = deferred(),
    release = deferred();
  let current = fixture();
  const old = queue.run(owner, () =>
    submitMenu([p], {
      read: () => current,
      write: async (d) => {
        current = d;
        await h.store.save(owner, d);
      },
      active: () => true,
      save: async () => {
        started.resolve();
        await release.promise;
        throw new Error("response lost");
      },
    }),
  );
  const failed = assert.rejects(old, /response lost/);
  await started.promise;
  const reopen = queue.run(owner, () => h.store.load(owner));
  release.resolve();
  await failed;
  const result = await reopen;
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("restore failed");
  let next: MenuDraft = {
    ...result.draft,
    items: result.draft.items.map((i) => ({
      ...i,
      name: "새로 고친 이름",
      productId: null,
    })),
  };
  const received: string[] = [];
  await queue.run(owner, () =>
    submitMenu([p], {
      read: () => next,
      write: async (d) => {
        next = d;
        await h.store.save(owner, d);
      },
      active: () => true,
      save: async (d) => {
        received.push(d.items[0].name);
        return d.revision + 1;
      },
    }),
  );
  assert.deepEqual(received, [fixture().items[0].name, "새로 고친 이름"]);
  assert.equal(next.revision, 2);
  assert.equal(next.pendingSave, undefined);
});

test("a cancelled queued submission never replays an uncertain save or rewrites its receipt", async () => {
  const current = fixture();
  current.pendingSave = { revision: 0, photos: [p], items: current.items };
  let saves = 0,
    writes = 0;
  assert.equal(
    await submitMenu([p], {
      read: () => current,
      write: async () => {
        writes++;
      },
      save: async () => {
        saves++;
        return 1;
      },
      active: () => false,
    }),
    null,
  );
  assert.equal(saves, 0);
  assert.equal(writes, 0);
  assert.equal(current.pendingSave.revision, 0);
});
