import test from "node:test";
import assert from "node:assert/strict";
import {
  createHomeLoader,
  type HomeLoadState,
} from "../src/features/home/latest";
import type { TasteContext } from "../src/features/taste/repository";
import type { DiscoveryResult } from "../src/features/discovery/contract";
const context: TasteContext = {
  snapshot: { hash: "current", records: [], totalRecords: 0, omittedCount: 0 },
  cached: null,
  stale: false,
  running: false,
};
const discovery = {
  tasteHash: "current",
  recommendations: [],
} as unknown as DiscoveryResult;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
test("recent records publish while optional photos and recommendation are still pending", async () => {
  const photo = deferred<Record<string, string>>(),
    recommendation = deferred<DiscoveryResult>();
  const states: HomeLoadState[] = [];
  const loader = createHomeLoader({
    context: async () => context,
    photos: () => photo.promise,
    discovery: () => recommendation.promise,
    publish: (s) => states.push(s),
  });
  const pending = loader.load();
  await Promise.resolve();
  assert.equal(states.at(-1)?.status, "ready");
  const first = states.at(-1);
  if (first?.status === "ready")
    assert.equal(first.data.recommendationState, "loading");
  photo.resolve({ photo: "signed" });
  recommendation.resolve(discovery);
  await pending;
  const last = states.at(-1);
  assert.equal(last?.status, "ready");
  if (last?.status === "ready") {
    assert.equal(last.data.photos.photo, "signed");
    assert.equal(last.data.discovery, discovery);
  }
});
test("optional failures preserve records and expose recommendation unavailability", async () => {
  const states: HomeLoadState[] = [];
  await createHomeLoader({
    context: async () => context,
    photos: async () => {
      throw Error();
    },
    discovery: async () => {
      throw Error();
    },
    publish: (s) => states.push(s),
  }).load();
  const last = states.at(-1);
  assert.equal(last?.status, "ready");
  if (last?.status === "ready") {
    assert.deepEqual(last.data.photos, {});
    assert.equal(last.data.recommendationState, "unavailable");
  }
});
test("canceled photo and recommendation requests never republish private data", async () => {
  const photo = deferred<Record<string, string>>(),
    recommendation = deferred<DiscoveryResult>(),
    states: HomeLoadState[] = [];
  const loader = createHomeLoader({
    context: async () => context,
    photos: () => photo.promise,
    discovery: () => recommendation.promise,
    publish: (s) => states.push(s),
  });
  const pending = loader.load();
  await Promise.resolve();
  loader.cancel();
  const count = states.length;
  photo.resolve({ secret: "old" });
  recommendation.resolve(discovery);
  await pending;
  assert.equal(states.length, count);
});
test("changed snapshot hides prior content and late photos cannot restore it", async () => {
  const photo = deferred<Record<string, string>>(),
    states: HomeLoadState[] = [];
  let reads = 0;
  const loader = createHomeLoader({
    context: async () =>
      ++reads === 1
        ? context
        : { ...context, snapshot: { ...context.snapshot, hash: "new" } },
    photos: () => photo.promise,
    discovery: async () => discovery,
    publish: (s) => states.push(s),
  });
  const pending = loader.load();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(states.at(-1)?.status, "failed");
  photo.resolve({ secret: "old" });
  await pending;
  assert.equal(states.at(-1)?.status, "failed");
});
test("recommendations from a different taste hash never appear", async () => {
  const states: HomeLoadState[] = [];
  await createHomeLoader({
    context: async () => context,
    photos: async () => ({}),
    discovery: async () => ({ ...discovery, tasteHash: "foreign" }),
    publish: (s) => states.push(s),
  }).load();
  const last = states.at(-1);
  assert.equal(last?.status, "ready");
  if (last?.status === "ready") {
    assert.equal(last.data.discovery, null);
    assert.equal(last.data.recommendationState, "unavailable");
  }
});
