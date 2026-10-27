import type { NextDrink } from "../supabase/functions/_shared/next-drinks-domain";
import test from "node:test";
import assert from "node:assert/strict";
import { parseDiscoveryResult } from "../src/features/discovery/contract";
import {
  products,
  PRODUCT_CATALOG_VERSION,
} from "../supabase/functions/_shared/product-catalog";
const result = () => ({
  // Explicit legacy deployment fixture: catalog exploration used to be returned without taste evidence.
  recommendations: products.map((product) => ({
    product: structuredClone(product),
    kind: "explore" as const,
    score: 0,
    similar: [],
    cautions: [],
    unconfirmedFeatures: structuredClone(product.features),
  })) as NextDrink[],
  wishlist: [],
  evidenceRecords: [],
  tasteHash: "empty",
  recordCount: 0,
  sensoryRecordCount: 0,
  omittedSensoryRecords: 0,
  method: "evidence-rules-v1",
  modelUsed: false,
  catalogVersion: PRODUCT_CATALOG_VERSION,
  catalogSize: products.length,
  limitedCatalog: true,
});
test("an older deployment's catalog filler is suppressed without deleting saved bookmarks", () => {
  const input = {
    ...result(),
    wishlist: [{ product_id: products[0].id, saved: true, revision: 1 }],
  };
  const parsed = parseDiscoveryResult(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(parsed.recommendations, []);
  assert.deepEqual(parsed.wishlist, input.wishlist);
});

test("rejects invented products, response URLs, duplicate products and incompatible catalogs", () => {
  const mutations = [
    (r: ReturnType<typeof result>) => {
      r.recommendations[0].product = {
        ...r.recommendations[0].product,
        id: "fake",
      };
    },
    (r: ReturnType<typeof result>) => {
      r.recommendations[0].product = {
        ...r.recommendations[0].product,
        source: {
          ...r.recommendations[0].product.source,
          url: "https://attacker.example",
        },
      };
    },
    (r: ReturnType<typeof result>) => {
      r.recommendations[1] = r.recommendations[0];
    },
    (r: ReturnType<typeof result>) => {
      r.catalogVersion = "old";
    },
    (r: ReturnType<typeof result>) => {
      r.modelUsed = true;
    },
    (r: ReturnType<typeof result>) => {
      r.sensoryRecordCount = 1;
    },
    (r: ReturnType<typeof result>) => {
      r.recommendations[0].score = Infinity;
    },
  ];
  for (const mutate of mutations) {
    const r = structuredClone(result());
    mutate(r);
    assert.throws(() => parseDiscoveryResult(r), /INVALID_DISCOVERY_RESPONSE/);
  }
});
test("rejects claims referencing missing records and unsupported feature identities", () => {
  const r = result(),
    recommendation = r.recommendations[0],
    feature = recommendation.product.features[0];
  recommendation.similar = [
    {
      factId: feature.id,
      label: feature.label,
      recordIds: ["missing"],
      negativeIds: [],
    },
  ];
  assert.throws(() => parseDiscoveryResult(r), /INVALID_DISCOVERY_RESPONSE/);
});
test("rejects malformed wishlists even when recommendations are valid", () => {
  for (const wishlist of [
    [{ product_id: products[0].id, saved: true, revision: 0 }],
    [{ product_id: "unknown", saved: true, revision: 1 }],
    [
      { product_id: products[0].id, saved: true, revision: 1 },
      { product_id: products[0].id, saved: false, revision: 2 },
    ],
  ])
    assert.throws(
      () => parseDiscoveryResult({ ...result(), wishlist }),
      /INVALID_DISCOVERY_RESPONSE/,
    );
});

test("old server recommendations are filtered by saved=true while retaining the bookmark and valid remaining evidence", () => {
  const product = products.find((p) => p.id === "glenlivet-12")!;
  const feature = product.features[0];
  const positive = {
    ...result(),
    recommendations: [{ product: structuredClone(product), kind: "close" as const, score: 1,
      similar: [{ factId: feature.id, label: feature.label, recordIds: ["own-record"], negativeIds: [] }],
      cautions: [], unconfirmedFeatures: [] }],
    recordCount: 1, sensoryRecordCount: 1,
    evidenceRecords: [{ id: "own-record", name: "합성 기록", category: "whisky", date: "2026-10-27", revision: 1, revisit: "again", noteText: null }],
    wishlist: [{ product_id: product.id, saved: true, revision: 1 }],
  };
  const parsed = parseDiscoveryResult(positive);
  assert.deepEqual(parsed.recommendations, []);
  assert.deepEqual(parsed.wishlist, positive.wishlist);
  const unsaved = parseDiscoveryResult({ ...positive, wishlist: [{ ...positive.wishlist[0], saved: false, revision: 2 }] });
  assert.equal(unsaved.recommendations[0].product.id, product.id);
  // A filtered product is still validated, never a way to smuggle arbitrary URLs or products.
  assert.throws(() => parseDiscoveryResult({ ...positive, recommendations: [{ ...positive.recommendations[0], product: { ...product, source: { ...product.source, url: "https://attacker.example" } } }] }), /INVALID_DISCOVERY_RESPONSE/);
});
