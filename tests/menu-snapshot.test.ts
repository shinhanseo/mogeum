import assert from "node:assert/strict";
import test from "node:test";
import { stableMenuRecommendation } from "../supabase/functions/_shared/menu-recommendation";
import { DiscoverySnapshotChanged } from "../supabase/functions/_shared/discovery-snapshot";
import { validateMenuResult } from "../src/features/menu/result-contract";
import type { MenuItem } from "../supabase/functions/_shared/menu-domain";
import type { TasteSnapshot } from "../supabase/functions/_shared/taste-domain";
const item: MenuItem = {
  id: "item",
  photoId: "photo",
  imageRevision: 1,
  lineIds: ["line"],
  name: "글렌리벳 12년",
  price: 15000,
  serving: "30ml",
  productId: "glenlivet-12",
  confirmed: true,
};
const snapshot: TasteSnapshot = {
  hash: "stable-version",
  totalRecords: 1,
  omittedCount: 0,
  records: [
    {
      id: "positive",
      entryId: "drink",
      revision: 1,
      name: "Synthetic whisky",
      category: "whisky",
      date: "2026-10-26",
      rating: null,
      revisit: "again",
      note: {
        mode: "light",
        version: 2,
        inputRevision: 1,
        confirmedInputRevision: 1,
        confirmed: true,
        answers: [
          {
            questionId: "nose",
            status: "answered",
            descriptorCodes: ["fruit"],
          },
        ],
      },
    },
  ],
};
test("menu result keeps its validated evidence and taste hash only after the final version check", async () => {
  let reads = 0;
  const result = await stableMenuRecommendation([item], async () => {
    reads++;
    return snapshot;
  });
  assert.equal(reads, 2);
  assert.equal(result.tasteHash, snapshot.hash);
  assert.ok(result.recommendations.length > 0);
  assert.deepEqual(
    result.evidenceRecords.map((r) => r.id),
    ["positive"],
  );
  validateMenuResult(result, [item]);
});
test("edited, deleted or added records cannot return a menu result built from the old version", async () => {
  for (const current of [
    { ...snapshot, hash: "edited" },
    { ...snapshot, totalRecords: 0 },
    { ...snapshot, totalRecords: 2 },
  ]) {
    let reads = 0;
    await assert.rejects(
      stableMenuRecommendation([item], async () =>
        ++reads === 1 ? snapshot : current,
      ),
      DiscoverySnapshotChanged,
    );
    assert.equal(reads, 2);
  }
});
test("failed final context check fails closed rather than returning stale menu evidence", async () => {
  let reads = 0;
  await assert.rejects(
    stableMenuRecommendation([item], async () => {
      if (++reads === 2) throw Error("context unavailable");
      return snapshot;
    }),
    /context unavailable/,
  );
  assert.equal(reads, 2);
});
