import test from "node:test";
import assert from "node:assert/strict";
import { reasonEvidence } from "../src/features/discovery/reason";
import type { DiscoveryResult } from "../src/features/discovery/contract";

const positive: DiscoveryResult["evidenceRecords"][number] = {
  id: "positive",
  name: "좋았던 술",
  category: "whisky",
  date: "2026-10-24",
  revision: 1,
  revisit: "again",
  noteText: null,
};
test("reason counts distinct supporting records and keeps opposite evaluations separate", () => {
  const negative = {
    ...positive,
    id: "negative",
    revisit: "not_for_me" as const,
  };
  const neutral = { ...positive, id: "neutral", revisit: "okay" as const };
  const records = [positive, negative, neutral, positive];
  const match = {
    factId: "향:과일 향",
    label: "과일 향",
    recordIds: ["positive", "positive", "neutral", "missing"],
    negativeIds: ["negative", "positive"],
  };
  assert.deepEqual(reasonEvidence(match, records, "positive"), [positive]);
  assert.deepEqual(reasonEvidence(match, records, "negative"), [negative]);
});
test("reason never acquires evidence merely from a matching category or label", () => {
  const match = {
    factId: "향:과일 향",
    label: "과일 향",
    recordIds: [],
    negativeIds: [],
  };
  assert.deepEqual(reasonEvidence(match, [positive], "positive"), []);
  assert.deepEqual(reasonEvidence(match, [positive], "negative"), []);
});

test("rating-only evidence remains usable without inventing a revisit answer", () => {
  const rated = { ...positive, revisit: null };
  const match = {
    factId: "향:과일 향",
    label: "과일 향",
    recordIds: ["positive"],
    negativeIds: [],
  };
  assert.deepEqual(reasonEvidence(match, [rated], "positive"), [rated]);
  assert.equal(reasonEvidence(match, [rated], "positive")[0].revisit, null);
});
