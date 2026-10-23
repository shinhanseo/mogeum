import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseMenu,
  validateItems,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
import {
  benchmarkMetrics,
  type BenchmarkCase,
} from "../src/features/menu/benchmark-metrics";
const fixtures = JSON.parse(
  readFileSync("assets/fixtures/ocr-benchmark/manifest.json", "utf8"),
) as BenchmarkCase[];
for (const platform of ["ios", "android"]) {
  const report = JSON.parse(
    readFileSync(
      `docs/verification/ocr-benchmark/${platform}-baseline-v1.json`,
      "utf8",
    ),
  );
  test(`${platform} real native two-column output replays without cross-column prices`, () => {
    const raw = report.cases.find(
      (c: { id: string }) => c.id === "two-columns",
    ).rawNative;
    const id = "90000000-0000-4000-8000-000000000001";
    const p: MenuPhoto = {
      ...raw,
      id,
      imageRevision: 1,
      lines: raw.lines.map((l: object, n: number) => ({
        ...l,
        id: `${id}:1:${n}`,
      })),
    };
    const items = parseMenu([p]);
    validateItems(items, [p]);
    const metrics = benchmarkMetrics(
      fixtures.find((f) => f.id === "two-columns")!,
      p,
      items,
    );
    assert.equal(metrics.correctPrices, platform === "ios" ? 6 : 2);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    for (const item of items)
      assert.ok(item.lineIds.every((id) => p.lines.some((l) => l.id === id)));
  });
}
