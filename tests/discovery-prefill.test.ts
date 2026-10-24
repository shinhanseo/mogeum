import test from "node:test";
import assert from "node:assert/strict";
import { discoveryPrefill } from "../src/features/discovery/prefill";
test("discovery recording prefills identity only, including explicit wine vintage", () => {
  assert.deepEqual(discoveryPrefill("cloudy-bay-sb-2024"), {
    name: "클라우디 베이 소비뇽 블랑 2024",
    category: "와인",
    vintageYear: "2024",
    vintageMode: "year",
  });
  const nv = discoveryPrefill("moet-imperial-brut-nv")!;
  assert.equal(nv.vintageMode, "NV");
  assert.equal(nv.vintageYear, "");
  const whisky = discoveryPrefill("glenlivet-12")!;
  assert.deepEqual(Object.keys(whisky).sort(), [
    "category",
    "name",
    "vintageMode",
    "vintageYear",
  ]);
  assert.equal(whisky.vintageYear, "");
  assert.equal(discoveryPrefill("invented-product"), null);
});
