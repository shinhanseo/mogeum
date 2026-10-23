import assert from "node:assert/strict";
import test from "node:test";
import { loadCellar } from "../src/features/cellar/load";
const owner = "owner-a";
const row = (n: number) => ({
  id: `entry-${n}`,
  user_id: owner,
  display_name: `술 ${n}`,
  category: "whisky",
  record_count: 1,
  photo_path: `${owner}/records/${n}/photo.jpg`,
});
test("205 cellar photos use three bounded signing calls and remain searchable in stable order", async () => {
  const rows = Array.from({ length: 205 }, (_, n) => row(n));
  const pages: number[] = [];
  const batches: number[] = [];
  const result = await loadCellar(owner, {
    active: () => true,
    page: async (from, size) => {
      pages.push(from);
      return rows.slice(from, from + size);
    },
    photos: async (paths) => {
      batches.push(paths.length);
      return new Map([...paths].reverse().map((path) => [path, `url:${path}`]));
    },
  });
  assert.deepEqual(pages, [0, 100, 200]);
  assert.deepEqual(batches, [100, 100, 5]);
  assert.equal(result?.length, 205);
  assert.equal(result?.[204].name, "술 204");
  assert.equal(result?.[204].photoUri, `url:${rows[204].photo_path}`);
});
test("batch failure keeps other photos, missing photos and all records", async () => {
  const rows = Array.from({ length: 101 }, (_, n) => row(n));
  let calls = 0;
  const result = await loadCellar(owner, {
    active: () => true,
    page: async (from, size) => rows.slice(from, from + size),
    photos: async (paths) => {
      if (++calls === 1) throw new Error("network");
      return new Map(paths.map((p) => [p, "last-url"]));
    },
  });
  assert.equal(result?.length, 101);
  assert.equal(result?.[0].photoUri, null);
  assert.equal(result?.[100].photoUri, "last-url");
});
test("account switch discards late data and stops all later signing requests", async () => {
  const rows = Array.from({ length: 101 }, (_, n) => row(n));
  let active = true,
    calls = 0;
  const result = await loadCellar(owner, {
    active: () => active,
    page: async (from, size) => rows.slice(from, from + size),
    photos: async () => {
      calls++;
      active = false;
      return new Map();
    },
  });
  assert.equal(result, null);
  assert.equal(calls, 1);
});
test("foreign rows, duplicate entries and unrequested signed paths cannot enter cellar output", async () => {
  const owned = row(1);
  let requested: string[] = [];
  const result = await loadCellar(owner, {
    active: () => true,
    page: async () => [owned, owned, { ...row(2), user_id: "other" }],
    photos: async (paths) => {
      requested = paths;
      return new Map([
        ["unrequested", "wrong"],
        [owned.photo_path, "right"],
      ]);
    },
  });
  assert.deepEqual(requested, [owned.photo_path]);
  assert.equal(result?.length, 1);
  assert.equal(result?.[0].photoUri, "right");
});
test("canceled metadata loading never starts photo requests", async () => {
  let active = true;
  assert.equal(
    await loadCellar(owner, {
      active: () => active,
      page: async () => {
        active = false;
        return [row(1)];
      },
      photos: async () => {
        throw new Error("must not call");
      },
    }),
    null,
  );
});
