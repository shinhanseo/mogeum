import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { products } from "../supabase/functions/_shared/product-catalog";
import {
  discoverDrinks,
  seenProductIds,
} from "../supabase/functions/_shared/next-drinks-domain";
import type { TasteSnapshot } from "../supabase/functions/_shared/taste-domain";
const empty: TasteSnapshot = {
  hash: "test",
  records: [],
  totalRecords: 0,
  omittedCount: 0,
};
test("empty and photo-only records are exploration, never sensory preference", () => {
  const photo = {
    id: "photo",
    entryId: "entry",
    revision: 1,
    category: "whisky",
    name: "사진 기록",
    date: "2026-10-23",
    revisit: "again",
    rating: null,
    note: null,
  };
  for (const snapshot of [
    empty,
    { ...empty, records: [photo], totalRecords: 1 },
  ]) {
    const result = discoverDrinks(snapshot, []);
    assert.equal(result.length, 32);
    assert.ok(
      result.every(
        (r) => r.kind === "explore" && r.similar.length === 0 && r.score === 0,
      ),
    );
    assert.equal(
      new Set(result.slice(0, 4).map((r) => r.product.category)).size,
      4,
    );
  }
});
test("wine history honors explicit vintage and never chooses an ambiguous edition", () => {
  const generic = {
    entered_name: "Cloudy Bay Sauvignon Blanc",
    category: "wine",
    vintage_status: "unknown",
    vintage_year: null,
  };
  assert.equal(seenProductIds([generic]).size, 0);
  const explicit = {
    ...generic,
    entered_name: "클라우디 베이 소비뇽 블랑 2024",
    vintage_status: "year",
    vintage_year: 2024,
  };
  assert.ok(seenProductIds([explicit]).has("cloudy-bay-sb-2024"));
  assert.equal(
    seenProductIds([{ ...explicit, vintage_year: 2023 }]).has(
      "cloudy-bay-sb-2024",
    ),
    false,
  );
});
test("known products from full history are excluded even if absent from recent sensory snapshot", () => {
  const result = discoverDrinks(empty, [
    {
      entered_name: "Glenfiddich 12",
      category: "whisky",
      vintage_status: null,
      vintage_year: null,
    },
  ]);
  assert.equal(
    result.some((r) => r.product.id === "glenfiddich-12"),
    false,
  );
  assert.equal(discoverDrinks(empty, [], "beer").length, 8);
});
test("wishlist SQL admits exactly the curated product IDs", () => {
  const sql = readFileSync(
    "supabase/migrations/20261023040000_drink_wishlist.sql",
    "utf8",
  );
  const ids = [...sql.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/g)].map(
    (m) => m[1],
  );
  assert.deepEqual([...new Set(ids)].sort(), products.map((p) => p.id).sort());
});

const positiveRecord = {
  id: "positive",
  entryId: "entry-positive",
  revision: 1,
  category: "whisky",
  name: "합성 느낌 기록",
  date: "2026-10-23",
  revisit: "again",
  rating: null,
  note: {
    mode: "light",
    version: 2,
    inputRevision: 1,
    confirmedInputRevision: 1,
    confirmed: true,
    answers: [
      { questionId: "nose", status: "answered", descriptorCodes: ["fruit"] },
      { questionId: "body", status: "answered", descriptorCodes: ["light"] },
    ],
  },
};
test("aroma can bridge categories but body/taste preference cannot leak into an untried category", () => {
  const result = discoverDrinks(
    { ...empty, records: [positiveRecord], totalRecords: 1 },
    [],
  );
  assert.ok(
    result.some(
      (r) =>
        r.product.category !== "whisky" &&
        r.similar.some((f) => f.factId.startsWith("향:")),
    ),
  );
  for (const r of result.filter((r) => r.product.category !== "whisky"))
    assert.ok(r.similar.every((f) => f.factId.startsWith("향:")));
  assert.ok(
    result
      .flatMap((r) => r.similar)
      .every((f) => f.recordIds.every((id) => id === "positive")),
  );
});
test("opposing observations stay visible without being reported as confident close preference", () => {
  const negative = {
    ...positiveRecord,
    id: "negative",
    entryId: "entry-negative",
    revisit: "not_for_me",
  };
  const result = discoverDrinks(
    { ...empty, records: [positiveRecord, negative], totalRecords: 2 },
    [],
  ).find((r) => r.product.id === "glenlivet-12")!;
  assert.equal(result.score, 0);
  assert.equal(result.kind, "explore");
  assert.deepEqual(result.similar[0].recordIds, ["positive"]);
  assert.deepEqual(result.cautions[0].negativeIds, ["negative"]);
});
test("negative-only observations are cautions, not invented positive matches", () => {
  const negative = { ...positiveRecord, id: "negative", revisit: "not_for_me" };
  const result = discoverDrinks(
    { ...empty, records: [negative], totalRecords: 1 },
    [],
  ).find((r) => r.product.id === "glenlivet-12")!;
  assert.equal(result.similar.length, 0);
  assert.equal(result.cautions.length, 1);
  assert.equal(result.score, -1);
  assert.ok(result.unconfirmedFeatures.every((f) => f.id !== "향:과일 향"));
});

test("unknown wine vintage does not silently become an NV product", () => {
  const product = products.find((p) => p.id === "moet-imperial-brut-nv")!;
  const record = {
    entered_name: product.name,
    category: "wine",
    vintage_status: "unknown",
    vintage_year: null,
  };
  assert.equal(seenProductIds([record]).has(product.id), false);
  assert.equal(
    seenProductIds([{ ...record, vintage_status: "nv" }]).has(product.id),
    true,
  );
});
