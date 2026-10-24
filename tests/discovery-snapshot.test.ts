import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscoverySnapshotChanged,
  withStableDiscoverySnapshot,
} from "../supabase/functions/_shared/discovery-snapshot";
import type { TasteSnapshot } from "../supabase/functions/_shared/taste-domain";

const snapshot = (hash = "before", totalRecords = 201): TasteSnapshot => ({
  hash,
  totalRecords,
  omittedCount: 1,
  records: [],
});

test("stable history returns the original response without rerunning the recommendation", async () => {
  let reads = 0,
    builds = 0;
  const result = { recommendations: ["unseen-product"] };
  assert.equal(
    await withStableDiscoverySnapshot(
      async () => {
        reads++;
        return snapshot();
      },
      async (input) => {
        builds++;
        assert.equal(input.totalRecords, 201);
        return result;
      },
    ),
    result,
  );
  assert.equal(reads, 2);
  assert.equal(builds, 1);
});

test("edit, deletion, or addition during a history page cannot publish mixed personal evidence", async () => {
  for (const next of [
    snapshot("edited"),
    snapshot("deleted", 200),
    snapshot("added", 202),
  ]) {
    let current = snapshot();
    let builds = 0;
    await assert.rejects(
      withStableDiscoverySnapshot(
        async () => current,
        async () => {
          builds++;
          // A concurrent write lands between history pages, before the response is ready.
          await Promise.resolve();
          current = next;
          return { recommendations: ["stale-result"] };
        },
      ),
      DiscoverySnapshotChanged,
    );
    assert.equal(
      builds,
      1,
      "do not silently retry or claim an old recommendation is current",
    );
  }
});

test("failed final check fails closed, and failed build never produces a successful result", async () => {
  let reads = 0;
  await assert.rejects(
    withStableDiscoverySnapshot(
      async () => {
        if (++reads === 2) throw new Error("CONTEXT_FAILED");
        return snapshot();
      },
      async () => "stale",
    ),
    /CONTEXT_FAILED/,
  );
  reads = 0;
  await assert.rejects(
    withStableDiscoverySnapshot(
      async () => {
        reads++;
        return snapshot();
      },
      async () => {
        throw new Error("HISTORY_FAILED");
      },
    ),
    /HISTORY_FAILED/,
  );
  assert.equal(reads, 1);
});

test("a reused snapshot object cannot change the captured comparison baseline", async () => {
  const value = snapshot();
  await assert.rejects(
    withStableDiscoverySnapshot(
      async () => value,
      async (input) => {
        input.hash = "modified";
        return "stale";
      },
    ),
    DiscoverySnapshotChanged,
  );
});
