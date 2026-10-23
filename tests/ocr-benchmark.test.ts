import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import {
  benchmarkMetrics,
  type BenchmarkCase,
} from "../src/features/menu/benchmark-metrics";
import type {
  MenuPhoto,
  MenuItem,
} from "../supabase/functions/_shared/menu-domain";
const photo = (texts: string[]): MenuPhoto => ({
  id: "fixture",
  imageRevision: 1,
  width: 100,
  height: 100,
  engine: "manual",
  lines: texts.map((text, n) => ({
    id: String(n),
    text,
    confidence: null,
    polygon: [],
  })),
});
const item = (
  name: string,
  price: number | null,
  serving: string | null = null,
): MenuItem => ({
  id: name,
  photoId: "fixture",
  imageRevision: 1,
  lineIds: [],
  name,
  price,
  serving,
  productId: null,
  confirmed: false,
});
const fixture: BenchmarkCase = {
  id: "synthetic",
  label: "synthetic",
  parseable: true,
  expected: [
    { name: "화요 25", price: 25000, serving: "375ml" },
    { name: "화요 25", price: 25000, serving: "375ml" },
  ],
};
test("benchmark duplicates require distinct native text and parsed entries", () => {
  const m = benchmarkMetrics(fixture, photo(["화요25 375ml 25,000원"]), [
    item("화요 25", 25000, "375ml"),
  ]);
  assert.equal(m.namesObserved, 1);
  assert.equal(m.correctPrices, 1);
  assert.equal(m.correctServings, 1);
  assert.equal(m.expectedEntries, 2);
});
test("right name with a wrong price is not counted as successful price association", () => {
  const f = { ...fixture, expected: fixture.expected.slice(0, 1) },
    m = benchmarkMetrics(f, photo(["화요25"]), [item("화요 25", 9000)]);
  assert.equal(m.namesObserved, 1);
  assert.equal(m.correctPrices, 0);
});
test("ambiguous/no-price layouts measure unsafe priced outputs separately", () => {
  const f = { ...fixture, parseable: false },
    m = benchmarkMetrics(f, photo(["화요25"]), [
      item("화요25", 25000),
      item("화요25", null),
    ]);
  assert.equal(m.abstentionViolations, 1);
});
test("unknown parsed items are not credited as ground-truth menu matches", () => {
  const m = benchmarkMetrics(fixture, photo(["화요25"]), [
    item("다른 술", 25000),
  ]);
  assert.equal(m.matchedNames, 0);
  assert.equal(m.unmatchedParsedItems, 1);
});
test("synthetic fixture manifest is reproducible, bounded and has committed PNGs", () => {
  const manifest = JSON.parse(
    readFileSync("assets/fixtures/ocr-benchmark/manifest.json", "utf8"),
  ) as BenchmarkCase[];
  assert.equal(manifest.length, 14);
  assert.equal(new Set(manifest.map((f) => f.id)).size, 14);
  for (const f of manifest) {
    assert.match(f.id, /^[a-z-]+$/);
    assert.ok(f.expected.length > 0);
    assert.ok(existsSync(`assets/fixtures/ocr-benchmark/${f.id}.png`));
  }
});
