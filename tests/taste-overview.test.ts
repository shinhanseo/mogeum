import test from "node:test";
import assert from "node:assert/strict";
import { tasteOverview } from "../src/features/taste/overview";
import type {
  TasteRecord,
  TasteSnapshot,
} from "../supabase/functions/_shared/taste-domain";
const record = (id: string, revisit: string, code: string): TasteRecord => ({
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
    text: null,
    answers: [
      { questionId: "nose", status: "answered", descriptorCodes: [code] },
    ],
  },
});
const snapshot = (records: TasteRecord[]): TasteSnapshot => ({
  hash: "test-only",
  records,
  totalRecords: records.length,
  omittedCount: 0,
});
test("neutral and negative observations remain visible without being labeled as preferences", () => {
  const view = tasteOverview(
    snapshot([
      record("neutral", "okay", "fruit"),
      record("negative", "not_for_me", "fruit"),
    ]),
  );
  assert.equal(view.observationsOnly, true);
  assert.equal(view.analysis.recordCount, 2);
  assert.equal(view.facts[0].positiveIds.length, 0);
  assert.deepEqual(view.originIds, ["negative", "neutral"]);
});
test("when positive observations exist, unrelated disliked sensations are not presented as favorites", () => {
  const view = tasteOverview(
    snapshot([
      record("liked", "again", "fruit"),
      record("disliked", "not_for_me", "smoke"),
    ]),
  );
  assert.equal(view.observationsOnly, false);
  assert.equal(view.analysis.facts.length, 2);
  assert.equal(view.facts.length, 1);
  assert.deepEqual(view.originIds, ["liked"]);
  assert.deepEqual(view.facts[0].positiveIds, ["liked"]);
});
test("photo-only and unfinished notes do not become sensory facts", () => {
  const draft = record("draft", "again", "fruit");
  draft.note!.confirmedInputRevision = 0;
  const view = tasteOverview(
    snapshot([{ ...record("photo", "okay", "fruit"), note: null }, draft]),
  );
  assert.equal(view.analysis.recordCount, 0);
  assert.deepEqual(view.facts, []);
  assert.deepEqual(view.originIds, []);
});
