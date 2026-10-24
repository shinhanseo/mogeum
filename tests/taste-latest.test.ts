import assert from "node:assert/strict";
import test from "node:test";
import {
  createLatestTasteLoader,
  type TasteLoadState,
} from "../src/features/taste/latest";
import type { TasteContext } from "../src/features/taste/repository";
const context: TasteContext = {
  snapshot: { hash: "current", totalRecords: 0, omittedCount: 0, records: [] },
  cached: null,
  stale: false,
  running: false,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("failed context refresh discards previous personal evidence while photo-only failures use placeholders", async () => {
  const states: TasteLoadState[] = [];
  let offline = false;
  const loader = createLatestTasteLoader({
    context: async () => {
      if (offline) throw new Error("OFFLINE");
      return context;
    },
    photos: async () => {
      throw new Error("SIGNED_URL_FAILED");
    },
    publish: (state) => states.push(state),
  });
  await loader.load();
  assert.deepEqual(states.at(-1), { status: "ready", context, photos: {} });
  offline = true;
  await loader.load();
  assert.deepEqual(states.slice(-2), [
    { status: "loading" },
    { status: "failed" },
  ]);
});
test("a superseded context response cannot publish records or start their photo lookup", async () => {
  const old = deferred<TasteContext>();
  const states: TasteLoadState[] = [];
  let calls = 0,
    photos = 0;
  const loader = createLatestTasteLoader({
    context: () => (++calls === 1 ? old.promise : Promise.resolve(context)),
    photos: async () => {
      photos++;
      return { current: "signed-current" };
    },
    publish: (state) => states.push(state),
  });
  const first = loader.load();
  await loader.load();
  old.resolve({ ...context, snapshot: { ...context.snapshot, hash: "old" } });
  await first;
  assert.equal(photos, 1);
  assert.deepEqual(states.at(-1), {
    status: "ready",
    context,
    photos: { current: "signed-current" },
  });
});
test("blur/unmount during photo signing or a failing context cannot publish after cancellation", async () => {
  const photo = deferred<Record<string, string>>();
  const states: TasteLoadState[] = [];
  const loader = createLatestTasteLoader({
    context: async () => context,
    photos: () => photo.promise,
    publish: (state) => states.push(state),
  });
  const loading = loader.load();
  await Promise.resolve();
  loader.cancel();
  photo.resolve({ private: "old-url" });
  await loading;
  assert.deepEqual(states, [{ status: "loading" }]);
  const failing = deferred<TasteContext>();
  const other = createLatestTasteLoader({
    context: () => failing.promise,
    photos: async () => ({}),
    publish: (state) => states.push(state),
  });
  const pending = other.load();
  other.cancel();
  failing.reject(new Error("OFFLINE"));
  await pending;
  assert.deepEqual(states, [{ status: "loading" }, { status: "loading" }]);
});
