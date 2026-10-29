import test from "node:test";
import assert from "node:assert/strict";
import { tasteEvidence } from "../src/features/taste/evidence";
import type {
  TasteRecord,
  TasteSnapshot,
} from "../supabase/functions/_shared/taste-domain";
const record = (id: string, revisit: string): TasteRecord => ({
  id,
  entryId: id,
  revision: 1,
  category: "whisky",
  name: id,
  date: "2026-10-29",
  revisit,
  rating: null,
  note: {
    mode: "light",
    version: 2,
    inputRevision: 1,
    confirmedInputRevision: 1,
    confirmed: true,
    answers: [
      { questionId: "nose", status: "answered", descriptorCodes: ["fruit"] },
    ],
    text: null,
  },
});
const records = [
  record("positive", "again"),
  record("neutral", "okay"),
  record("negative", "not_for_me"),
];
const snapshot: TasteSnapshot = {
  hash: "test-only",
  totalRecords: 3,
  omittedCount: 0,
  records,
};
test("all current evidence works before generating an AI summary and includes neutral evaluations", () => {
  const value = tasteEvidence(snapshot);
  assert.deepEqual(
    value.records.map((r) => r.id),
    ["positive", "neutral", "negative"],
  );
  assert.equal(value.facts.length, 1);
});
test("fact evidence includes every evaluation counted in the overview", () => {
  const id = tasteEvidence(snapshot).facts[0].id;
  assert.equal(tasteEvidence(snapshot, id).records.length, 3);
  assert.deepEqual(tasteEvidence(snapshot, "removed-fact"), {
    facts: [],
    records: [],
  });
});
test("unconfirmed and photo-only records never become sensory evidence", () => {
  const draft = record("draft", "again");
  draft.note!.confirmedInputRevision = 0;
  const photoOnly = { ...record("photo", "again"), note: null };
  assert.equal(
    tasteEvidence({ ...snapshot, records: [draft, photoOnly] }).records.length,
    0,
  );
});
