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
test("empty and photo-only records never produce personal recommendations", () => {
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
    assert.deepEqual(result, []);
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
  const result = discoverDrinks(
    { ...empty, records: [positiveRecord], totalRecords: 1 },
    [
      {
        entered_name: "Glenfiddich 12",
        category: "whisky",
        vintage_status: null,
        vintage_year: null,
      },
    ],
  );
  assert.equal(
    result.some((r) => r.product.id === "glenfiddich-12"),
    false,
  );
  assert.deepEqual(discoverDrinks(empty, [], "beer"), []);
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
test("equally opposing observations do not become personal recommendations", () => {
  const negative = {
    ...positiveRecord,
    id: "negative",
    entryId: "entry-negative",
    revisit: "not_for_me",
  };
  const result = discoverDrinks(
    { ...empty, records: [positiveRecord, negative], totalRecords: 2 },
    [],
  );
  assert.ok(!result.some((r) => r.product.id === "glenlivet-12"));
});
test("negative-only observations are cautions, not invented positive matches", () => {
  const negative = { ...positiveRecord, id: "negative", revisit: "not_for_me" };
  const result = discoverDrinks(
    { ...empty, records: [negative], totalRecords: 1 },
    [],
  );
  assert.deepEqual(result, []);
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

test("neutral and unevaluated sensory observations do not invent a preference", () => {
  for (const revisit of ["okay", null])
    assert.deepEqual(
      discoverDrinks(
        {
          ...empty,
          records: [{ ...positiveRecord, revisit }],
          totalRecords: 1,
        },
        [],
      ),
      [],
    );
});
test("positive matches retain contrary evidence, without padding the list with uncited catalog entries", () => {
  const records = [
    positiveRecord,
    { ...positiveRecord, id: "positive2", entryId: "entry2" },
    {
      ...positiveRecord,
      id: "negative",
      entryId: "entry3",
      revisit: "not_for_me",
    },
  ];
  const rows = discoverDrinks({ ...empty, records, totalRecords: 3 }, []);
  assert.ok(rows.length > 0 && rows.length < products.length);
  assert.ok(
    rows.every((r) => r.score > 0 && r.similar.some((f) => f.recordIds.length)),
  );
  const row = rows.find((r) => r.product.id === "glenlivet-12")!;
  assert.deepEqual(row.similar[0].recordIds, ["positive", "positive2"]);
  assert.deepEqual(row.cautions[0].negativeIds, ["negative"]);
});
