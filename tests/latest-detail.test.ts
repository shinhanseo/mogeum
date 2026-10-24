import assert from "node:assert/strict";
import test from "node:test";
import {
  createLatestDetailLoader,
  type DetailLoadState,
} from "../src/features/records/latest-detail";
import type { loadRecordDetail } from "../src/features/records/detail";
type Detail = Awaited<ReturnType<typeof loadRecordDetail>>;
const value = (
  revision = 1,
  photoUri: string | null = "signed-original",
): Detail => ({
  record: {
    id: "record",
    revision,
    cellar_entry_id: "entry",
    entered_name: "합성 기록",
    category: "whisky",
    consumed_at: "2026-10-19T12:00:00Z",
    revisit: "again",
    rating: null,
    vintage_status: null,
    vintage_year: null,
    record_photos: [
      {
        storage_path: "synthetic/photo.jpg",
        sort_order: 0,
        upload_status: "ready",
      },
    ],
    record_notes: null,
  },
  history: [{ id: "record", consumed_at: "2026-10-19T12:00:00Z" }],
  photoUri,
});
function deferred() {
  let resolve!: (value: Detail) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Detail>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
test("refresh hides old detail immediately and failure cannot expose previous record, history or photo", async () => {
  const states: DetailLoadState[] = [];
  let fail = false;
  const loader = createLatestDetailLoader({
    read: async () => {
      if (fail) throw Error("deleted or offline");
      return value();
    },
    publish: (s) => states.push(s),
  });
  await loader.load();
  assert.equal(states.at(-1)?.status, "ready");
  fail = true;
  const pending = loader.load();
  assert.deepEqual(states.at(-1), { status: "loading" });
  await pending;
  assert.deepEqual(states.at(-1), { status: "failed" });
});
test("cancelled and superseded reads cannot resurrect older detail after navigation or foreground refresh", async () => {
  const old = deferred(),
    fresh = deferred();
  let calls = 0;
  const states: DetailLoadState[] = [];
  const loader = createLatestDetailLoader({
    read: () => (++calls === 1 ? old.promise : fresh.promise),
    publish: (s) => states.push(s),
  });
  const first = loader.load();
  loader.cancel();
  const second = loader.load();
  fresh.resolve(value(2));
  await second;
  old.resolve(value(1));
  await first;
  assert.deepEqual(states.at(-1), { status: "ready", value: value(2) });
  const third = deferred();
  const cancelled = createLatestDetailLoader({
    read: () => third.promise,
    publish: (s) => states.push(s),
  });
  const pending = cancelled.load();
  cancelled.cancel();
  third.reject(Error("late error"));
  await pending;
  assert.deepEqual(states.at(-1), { status: "loading" });
});
test("only a displayed failed photo may renew once per record revision; renewed failures cannot loop", async () => {
  let calls = 0;
  const states: DetailLoadState[] = [];
  const loader = createLatestDetailLoader({
    read: async () =>
      value(1, ++calls === 1 ? "signed-original" : "signed-renewed"),
    publish: (s) => states.push(s),
  });
  await loader.load();
  await loader.refreshPhoto("foreign");
  assert.equal(calls, 1);
  await loader.refreshPhoto("signed-original");
  assert.equal(calls, 2);
  assert.deepEqual(states.at(-1), {
    status: "ready",
    value: value(1, "signed-renewed"),
  });
  await loader.refreshPhoto("signed-original");
  await loader.refreshPhoto("signed-renewed");
  assert.equal(calls, 2);
  await loader.load();
  await loader.refreshPhoto("signed-renewed");
  assert.equal(calls, 4);
});
test("a photo renewal cannot publish after background cancellation or keep a deleted record visible", async () => {
  const refresh = deferred();
  let calls = 0;
  const states: DetailLoadState[] = [];
  const loader = createLatestDetailLoader({
    read: () => (++calls === 1 ? Promise.resolve(value()) : refresh.promise),
    publish: (s) => states.push(s),
  });
  await loader.load();
  const pending = loader.refreshPhoto("signed-original");
  loader.cancel();
  refresh.resolve(value(2));
  await pending;
  assert.deepEqual(states.at(-1), { status: "loading" });
  const deleted = createLatestDetailLoader({
    read: async () => {
      if (++calls > 3) throw Error("deleted");
      return value();
    },
    publish: (s) => states.push(s),
  });
  await deleted.load();
  await deleted.refreshPhoto("signed-original");
  assert.deepEqual(states.at(-1), { status: "failed" });
});
