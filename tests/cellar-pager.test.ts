import assert from "node:assert/strict";
import test from "node:test";
import {
  createCellarPager,
  type CellarPageState,
} from "../src/features/cellar/pager";
import type { CellarPage } from "../src/features/cellar/repository";
const item = (id: string) => ({
  id,
  name: id,
  category: null,
  photoUri: null,
  recordCount: 1,
});
const cursor = { date: "2026-10-23T00:00:00.123456+00:00", id: "last" };
test("cursor paging coalesces duplicate end events, keeps items on failure, and retries same cursor", async () => {
  let current!: CellarPageState;
  const inputs: unknown[] = [];
  let finish!: (p: CellarPage) => void;
  let fail = true;
  const pager = createCellarPager(
    async (_, c) => {
      inputs.push(c);
      if (!c) return { items: [item("a")], next: cursor, total: 2 };
      if (fail) {
        fail = false;
        throw new Error("offline");
      }
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    (s) => {
      current = s;
    },
  );
  await pager.reset({ query: "", category: "전체" });
  await pager.next();
  assert.equal(current.error, true);
  assert.equal(current.items.length, 1);
  await pager.next();
  assert.equal(inputs.length, 2);
  const pending = pager.retry();
  await pager.next();
  assert.equal(inputs.length, 3);
  assert.deepEqual(inputs[1], inputs[2]);
  finish({ items: [item("a"), item("b")], next: null, total: null });
  await pending;
  assert.deepEqual(
    current.items.map((i) => i.id),
    ["a", "b"],
  );
  assert.equal(current.total, 2);
  assert.equal(current.hasMore, false);
});
test("late filter results cannot publish into a new search or alter its cursor", async () => {
  let old!: (p: CellarPage) => void, current!: CellarPageState;
  const pager = createCellarPager(
    async (filter) =>
      filter.query === "old"
        ? new Promise((resolve) => {
            old = resolve;
          })
        : { items: [item("new")], next: null, total: 1 },
    (s) => {
      current = s;
    },
  );
  const first = pager.reset({ query: "old", category: "전체" });
  await pager.reset({ query: "new", category: "와인" });
  old({ items: [item("private-old")], next: cursor, total: 99 });
  await first;
  assert.deepEqual(
    current.items.map((i) => i.id),
    ["new"],
  );
  assert.equal(current.hasMore, false);
});
test("cancel prevents late completion and repeating cursor fails without losing existing rows", async () => {
  let count = 0,
    current!: CellarPageState;
  const pager = createCellarPager(
    async () => ({ items: [item(String(++count))], next: cursor, total: 2 }),
    (s) => {
      current = s;
    },
  );
  await pager.reset({ query: "", category: "전체" });
  await pager.next();
  assert.equal(current.error, true);
  assert.equal(current.items.length, 1);
  pager.cancel();
});

test("canceling an in-flight page never publishes its data", async () => {
  let finish!: (p: CellarPage) => void;
  const seen: CellarPageState[] = [];
  const pager = createCellarPager(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    (s) => seen.push(s),
  );
  const pending = pager.reset({ query: "", category: "전체" });
  pager.cancel();
  finish({ items: [item("old-owner")], next: null, total: 1 });
  await pending;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].loading, true);
});

test("photo renewal is limited to one attempt per entry and cannot refresh unknown or superseded URLs", async () => {
  let calls = 0,
    current!: CellarPageState;
  const pager = createCellarPager(
    async () => ({
      items: [{ ...item("a"), photoUri: "expired" }],
      next: null,
      total: 1,
    }),
    (s) => {
      current = s;
    },
    0,
    async () => {
      calls++;
      return "renewed";
    },
  );
  await pager.reset({ query: "", category: "전체" });
  await pager.refreshPhoto("other", "expired");
  await pager.refreshPhoto("a", "not-current");
  assert.equal(calls, 0);
  await Promise.all([
    pager.refreshPhoto("a", "expired"),
    pager.refreshPhoto("a", "expired"),
  ]);
  assert.equal(calls, 1);
  assert.equal(current.items[0].photoUri, "renewed");
  await pager.refreshPhoto("a", "renewed");
  assert.equal(calls, 1);
});
test("late photo renewal after cancel cannot publish into another session", async () => {
  let finish!: (uri: string) => void, current!: CellarPageState;
  const pager = createCellarPager(
    async () => ({
      items: [{ ...item("a"), photoUri: "expired" }],
      next: null,
      total: 1,
    }),
    (s) => {
      current = s;
    },
    0,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await pager.reset({ query: "", category: "전체" });
  const pending = pager.refreshPhoto("a", "expired");
  pager.cancel();
  finish("late");
  await pending;
  assert.equal(current.items[0].photoUri, "expired");
});
test("photo renewal failure does not lose records or start an automatic retry loop", async () => {
  let calls = 0,
    current!: CellarPageState;
  const pager = createCellarPager(
    async () => ({
      items: [{ ...item("a"), photoUri: "expired" }],
      next: null,
      total: 1,
    }),
    (s) => {
      current = s;
    },
    0,
    async () => {
      calls++;
      throw new Error("offline");
    },
  );
  await pager.reset({ query: "", category: "전체" });
  await pager.refreshPhoto("a", "expired");
  await pager.refreshPhoto("a", "expired");
  assert.equal(calls, 1);
  assert.equal(current.items[0].photoUri, "expired");
  assert.equal(current.error, false);
});
