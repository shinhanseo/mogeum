import {products} from "../supabase/functions/_shared/product-catalog";
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


test("retailer name years do not prefill a confirmed personal wine vintage", () => {
  const sample = products.find(product => product.id === "cloudy-bay-sb-2024")!;
  for (const kind of ["retailer", "public-dataset"] as const) {
    const product = {...sample, edition:"제품명 표기 연도 1924", source:{...sample.source,kind}};
    assert.deepEqual(discoveryPrefill(product.id,[product]),{name:product.name,category:"와인",vintageYear:"",vintageMode:"unknown"});
  }
});
