import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredMenu, readStoredMenu } from "../src/features/menu/restore";
import {
  parseMenu,
  validateItems,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
import type { MenuDraft } from "../src/features/menu/device";
const owner = "synthetic-owner",
  directory = "file:///synthetic/";
const id = "90000000-0000-4000-8000-000000000001",
  pid = "90000000-0000-4000-8000-000000000002";
function fixture(): MenuDraft {
  const p: MenuPhoto = {
    id: pid,
    imageRevision: 1,
    width: 1200,
    height: 1600,
    engine: "apple-vision-v1",
    lines: [
      {
        id: `${pid}:1:0`,
        text: "글렌피딕 12년 15,000원",
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
  return {
    id,
    revision: 0,
    photos: [
      {
        id: pid,
        imageRevision: 1,
        width: 1200,
        height: 1600,
        state: "ready",
        uri: `${directory}menu-drafts/${owner}/${id}/${pid}-1.jpg`,
        ocr: p,
      },
    ],
    items: parseMenu([p]),
  };
}
const restore = (value: unknown) =>
  parseStoredMenu(JSON.stringify(value), owner, directory);
test("a relocated iOS menu preserves corrected input, pending request and photo revision without reading the old sandbox", () => {
  const root = "file:///var/mobile/Containers/Data/Application/";
  const old = `${root}14422F63-BB97-4116-9AA5-37DD3F82D4F1/Documents/`;
  const current = `${root}2A8FBFC8-9D84-4073-AF03-61EE1FE96BBD/Documents/`;
  const d = fixture();
  d.photos[0].uri = `${old}menu-drafts/${owner}/${id}/${pid}-1.jpg`;
  d.items[0].name = "직접 남긴 이름";
  d.items[0].productId = null;
  d.items[0].price = 21000;
  d.pendingSave = {
    revision: d.revision,
    photos: [d.photos[0].ocr!],
    items: structuredClone(d.items),
  };
  const raw = JSON.stringify(d);
  const restored = parseStoredMenu(raw, owner, current);
  assert.equal(
    restored.photos[0].uri,
    `${current}menu-drafts/${owner}/${id}/${pid}-1.jpg`,
  );
  assert.equal(restored.photos[0].imageRevision, 1);
  assert.equal(restored.items[0].name, "직접 남긴 이름");
  assert.equal(restored.items[0].price, 21000);
  assert.deepEqual(restored.pendingSave, d.pendingSave);
  assert.equal(JSON.stringify(d), raw);
  assert.throws(
    () => parseStoredMenu(raw, "other-account", current),
    /INVALID_MENU_DRAFT/,
  );
});
test("real empty storage is distinct from unavailable storage or malformed metadata", async () => {
  assert.deepEqual(
    await readStoredMenu(
      async () => null,
      async () => fixture(),
    ),
    { status: "empty" },
  );
  assert.deepEqual(
    await readStoredMenu(
      async () => {
        throw new Error("device locked");
      },
      async () => fixture(),
    ),
    { status: "failed" },
  );
  for (const raw of ["", "{", "null", "[]"])
    assert.deepEqual(
      await readStoredMenu(
        async () => raw,
        async (raw) => parseStoredMenu(raw, owner, directory),
      ),
      { status: "failed" },
    );
});
test("read failure does not write, remove or reinterpret existing raw input as a new session", async () => {
  const raw = JSON.stringify(fixture());
  let reads = 0;
  const first = await readStoredMenu(
    async () => {
      reads++;
      throw new Error("temporary read failure");
    },
    async () => {
      throw new Error("must not hydrate");
    },
  );
  assert.equal(first.status, "failed");
  const second = await readStoredMenu(
    async () => {
      reads++;
      return raw;
    },
    async (raw) => parseStoredMenu(raw, owner, directory),
  );
  assert.equal(second.status, "ready");
  assert.equal(reads, 2);
  if (second.status === "ready")
    assert.equal(second.draft.items[0].name, "글렌피딕 12년");
});
test("photo-check failures remain recoverable read failures rather than erased drafts", async () => {
  const raw = JSON.stringify(fixture());
  assert.equal(
    (
      await readStoredMenu(
        async () => raw,
        async () => {
          throw new Error("file storage unavailable");
        },
      )
    ).status,
    "failed",
  );
  assert.equal(restore(JSON.parse(raw)).photos.length, 1);
});
test("old drafts restore without optional metadata and preserve typed correction fields", () => {
  const d = fixture();
  d.items[0] = {
    ...d.items[0],
    name: "직접 남긴 이름",
    price: 21000,
    serving: "한 잔",
    confirmed: true,
  };
  const r = restore(d);
  assert.equal(r.items[0].name, "직접 남긴 이름");
  assert.equal(r.items[0].price, 21000);
  assert.deepEqual(r.exclusions, []);
});
test("unknown catalog choices become unconfirmed without changing the exact uncertain save payload", () => {
  const d = fixture();
  d.items[0] = {
    ...d.items[0],
    productId: "retired-product-id",
    confirmed: true,
  };
  d.pendingSave = {
    revision: 0,
    photos: [d.photos[0].ocr!],
    items: structuredClone(d.items),
  };
  const pending = JSON.stringify(d.pendingSave);
  const r = restore(d);
  assert.equal(r.items[0].productId, null);
  assert.equal(r.items[0].confirmed, false);
  assert.equal(JSON.stringify(r.pendingSave), pending);
  assert.equal(
    validateItems(r.pendingSave!.items, r.pendingSave!.photos, "stored").length,
    1,
  );
  assert.throws(
    () => validateItems(r.pendingSave!.items, r.pendingSave!.photos),
    /INVALID_ITEM/,
  );
});
test("a currently verified product choice remains intact", () => {
  const d = fixture();
  d.items[0] = { ...d.items[0], productId: "glenfiddich-12", confirmed: true };
  assert.equal(restore(d).items[0].productId, "glenfiddich-12");
});
test("failed photos can retain bounded typed input without inventing OCR source lines", () => {
  const d = fixture();
  d.photos[0].ocr = null;
  d.photos[0].state = "failed";
  const r = restore(d);
  assert.equal(r.photos[0].ocr, null);
  assert.equal(r.items[0].name, d.items[0].name);
});
for (const [name, mutate] of Object.entries({
  "other owner path": (d: MenuDraft) => {
    d.photos[0].uri = d.photos[0].uri.replace(owner, "other-owner");
  },
  "duplicate photo": (d: MenuDraft) => {
    d.photos.push({ ...d.photos[0] });
  },
  "foreign image revision": (d: MenuDraft) => {
    d.photos[0].ocr!.imageRevision = 2;
  },
  "different OCR dimensions": (d: MenuDraft) => {
    d.photos[0].ocr!.width = 100;
  },
  "invalid typed name": (d: MenuDraft) => {
    d.items[0].name = "x".repeat(151);
  },
  "duplicate item": (d: MenuDraft) => {
    d.items.push({ ...d.items[0] });
  },
  "foreign source photo": (d: MenuDraft) => {
    d.items[0].photoId = id;
  },
  "foreign source line": (d: MenuDraft) => {
    d.items[0].lineIds = [`${id}:1:0`];
  },
  "unsafe opaque product ID": (d: MenuDraft) => {
    d.items[0].productId = "x".repeat(161);
  },
  "invalid pending revision": (d: MenuDraft) => {
    d.pendingSave = { revision: 1, photos: [d.photos[0].ocr!], items: d.items };
  },
  "invalid pending source": (d: MenuDraft) => {
    d.pendingSave = {
      revision: 0,
      photos: [d.photos[0].ocr!],
      items: [{ ...d.items[0], lineIds: ["not-on-menu"] }],
    };
  },
}))
  test(`restore rejects ${name} without changing original input`, () => {
    const d = fixture();
    mutate(d);
    const original = JSON.stringify(d);
    assert.throws(() => parseStoredMenu(original, owner, directory));
    assert.equal(JSON.stringify(d), original);
  });
test("corrupt exclusion metadata does not discard otherwise valid photos or user input", () => {
  const d = fixture();
  const r = restore({ ...d, exclusions: [null, { injected: "data" }] });
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.exclusions, []);
});

test("unfinished manual entry restores as editable input but cannot be sent as a confirmed menu", () => {
  const d = fixture();
  d.items = [
    {
      ...d.items[0],
      id: `${pid}:1:manual:one`,
      lineIds: [],
      name: "",
      confirmed: false,
    },
  ];
  const r = restore(d);
  assert.equal(r.items[0].name, "");
  assert.equal(r.items[0].confirmed, false);
  assert.throws(
    () => validateItems(r.items, [d.photos[0].ocr!]),
    /INVALID_ITEM/,
  );
  d.items[0].confirmed = true;
  assert.throws(() => restore(d), /INVALID_ITEM/);
});
