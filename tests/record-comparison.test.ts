import test from "node:test";
import assert from "node:assert/strict";
import {
  compareRecords,
  type ComparableRecord,
  type ComparisonAnswer,
} from "../src/features/records/comparison";
const answer = (
  question_id: string,
  descriptor_codes: string[],
  status = "answered",
): ComparisonAnswer => ({
  question_id,
  descriptor_codes,
  status,
  mode: "light",
  catalog_version: 2,
});
function record(id: string, answers: ComparisonAnswer[]): ComparableRecord {
  return {
    id,
    cellar_entry_id: "same-entry",
    category: "whisky",
    consumed_at: "2026-11-06T00:00:00Z",
    revisit: "again",
    vintage_status: null,
    vintage_year: null,
    record_notes: {
      mode: "light",
      catalog_version: 2,
      confirmed_note: "내가 확인한 노트",
      input_revision: 2,
      confirmed_input_revision: 2,
    },
    record_answers: answers,
  };
}
test("compares observations without treating omitted answers as lost sensations", () => {
  const previous = record("old", [
    answer("nose", ["fruit"]),
    answer("body", ["light"]),
  ]);
  const current = record("new", [
    answer("nose", ["honey_vanilla"]),
    answer("body", [], "skipped"),
  ]);
  const result = compareRecords(current, previous)!;
  assert.deepEqual(result.changes, [
    { label: "향", before: "과일", after: "꿀·바닐라" },
  ]);
  assert.equal(result.unchanged, 0);
  assert.deepEqual(result.revisit, {
    before: "또 마시고 싶어요",
    after: "또 마시고 싶어요",
  });
});
test("canonical option ordering and unknown states cannot invent a change", () => {
  const a = record("a", [
    answer("nose", ["fruit", "wood"]),
    answer("palate", [], "unknown"),
  ]);
  const b = record("b", [
    answer("nose", ["wood", "fruit"]),
    answer("palate", ["sweet"]),
  ]);
  const result = compareRecords(a, b)!;
  assert.equal(result.changes.length, 0);
  assert.equal(result.unchanged, 1);
});
test("different note modes, stale confirmation and different wine vintage suppress sensory comparisons", () => {
  const a = record("a", [answer("nose", ["fruit"])]),
    b = record("b", [answer("nose", ["wood"])]);
  for (const modified of [
    { ...b, record_notes: { ...b.record_notes!, mode: "deep" } },
    { ...b, record_notes: { ...b.record_notes!, confirmed_input_revision: 1 } },
    { ...b, record_notes: null },
  ]) {
    const result = compareRecords(a, modified)!;
    assert.equal(result.limited, true);
    assert.equal(result.changes.length, 0);
  }
  assert.equal(
    compareRecords(
      { ...a, category: "wine", vintage_status: "year", vintage_year: 2023 },
      { ...b, category: "wine", vintage_status: "year", vintage_year: 2024 },
    )!.limited,
    true,
  );
});
test("cannot compare another drink, another category, or itself", () => {
  const a = record("a", []),
    b = record("b", []);
  assert.equal(compareRecords(a, a), null);
  assert.equal(compareRecords(a, { ...b, cellar_entry_id: "different" }), null);
  assert.equal(compareRecords(a, { ...b, category: "beer" }), null);
});
test("revisit changes are separate from sensations and require two actual evaluations", () => {
  const a = record("a", []),
    b = record("b", []);
  assert.deepEqual(compareRecords({ ...a, revisit: "okay" }, b)!.revisit, {
    before: "또 마시고 싶어요",
    after: "괜찮아요",
  });
  assert.equal(compareRecords({ ...a, revisit: null }, b)!.revisit, null);
});
test("deep notes compare selected aroma details; a broad-only answer remains a broad comparison", () => {
  const deep = (id: string, codes: string[]) => {
    const r = record(id, [{ ...answer("nose", codes), mode: "deep" }]);
    r.record_notes!.mode = "deep";
    return r;
  };
  const old = deep("old", ["family.fruit", "detail.fruit.apple_pear"]);
  const current = deep("new", ["family.fruit", "detail.fruit.citrus"]);
  assert.deepEqual(compareRecords(current, old)!.changes, [
    { label: "향", before: "사과·배", after: "감귤" },
  ]);
  assert.equal(
    compareRecords(current, deep("broad", ["family.fruit"]))!.changes.length,
    0,
  );
});
