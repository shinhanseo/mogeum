import test from "node:test";
import assert from "node:assert/strict";
import { generationCopy } from "../src/features/discovery/generation-copy";

test("weekly explanation distinguishes incomplete evidence, waiting and actual model selection", () => {
  assert.equal(generationCopy(undefined), null);
  assert.equal(generationCopy({state: "insufficient"}), null);
  for (const state of ["running", "backoff", "daily-limit", "invalidated"] as const) {
    const copy = generationCopy({state, nextGenerationAt: "2026-11-05T00:00:00Z"});
    assert.ok(copy?.title);
    assert.ok(!copy.body.includes("Gemini가 골랐어요"));
  }
  assert.match(generationCopy({state: "cached", generatedAt: "2026-10-29T00:00:00Z", nextGenerationAt: "2026-11-05T00:00:00Z"})!.body, /Gemini가 골랐어요.*11월 5일/);
});
