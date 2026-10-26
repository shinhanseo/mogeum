/// <reference lib="deno.ns" />
import { selectHighlights } from "../functions/taste-summary/provider.ts";
import {
  analyzeTaste,
  type TasteRecord,
} from "../functions/_shared/taste-domain.ts";
if (Deno.env.get("MOGEUM_VERIFY_AI_PROVIDER") !== "1")
  throw Error("EXPLICIT_SYNTHETIC_PROVIDER_OPT_IN_REQUIRED");
const key = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
if (!key) throw Error("PROVIDER_KEY_REQUIRED");
const record = (
  n: number,
  nose: string[],
  revisit: "again" | "not_for_me" = "again",
  extra = false,
): TasteRecord => ({
  id: `synthetic-${n}`,
  entryId: `drink-${n}`,
  revision: 1,
  category: "whisky",
  name: "합성 검증",
  date: "2026-10-26",
  revisit,
  rating: null,
  note: {
    mode: "light",
    version: 2,
    inputRevision: 1,
    confirmedInputRevision: 1,
    confirmed: true,
    answers: [
      { questionId: "nose", status: "answered", descriptorCodes: nose },
      ...(extra
        ? [
            {
              questionId: "palate",
              status: "answered",
              descriptorCodes: ["fresh"],
            },
            {
              questionId: "body",
              status: "answered",
              descriptorCodes: ["light"],
            },
          ]
        : []),
    ],
  },
});
const cases = [
  { id: "early", records: [record(1, ["fruit"])] },
  {
    id: "multiple-dimensions",
    records: [1, 2, 3, 4].map((n) =>
      record(n, ["fruit", "honey_vanilla"], "again", true),
    ),
  },
  {
    id: "mixed-preference",
    records: [
      record(1, ["fruit"]),
      record(2, ["fruit"], "not_for_me"),
      record(3, ["smoke"], "not_for_me"),
    ],
  },
];
const results = [];
for (const test of cases) {
  const analysis = analyzeTaste({
    hash: "synthetic",
    totalRecords: test.records.length,
    omittedCount: 0,
    records: test.records,
  });
  const start = Date.now();
  try {
    const selection = await selectHighlights(
      analysis,
      key,
      "gemini-3.5-flash-lite",
      AbortSignal.timeout(30000),
    );
    results.push({
      case: test.id,
      success: true,
      durationMs: Date.now() - start,
      highlightIds: selection.highlightIds,
      allowedFacts: analysis.facts
        .filter((f) => f.positiveIds.length > 0)
        .map((f) => f.id),
    });
  } catch (e) {
    results.push({
      case: test.id,
      success: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.name : "Unknown",
    });
  }
}
console.log(
  JSON.stringify({
    syntheticOnly: true,
    model: "gemini-3.5-flash-lite",
    automaticRetries: 0,
    results,
  }),
);
if (results.some((r) => !r.success)) Deno.exitCode = 1;
