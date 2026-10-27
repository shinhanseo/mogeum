import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../supabase/functions/_shared/product-catalog";
import {
  catalogProduct,
  parseCatalogDocument,
  SHARED_CATALOG_VERSION,
  verifiedCatalogRow,
} from "../supabase/functions/_shared/catalog-contract";
import {
  discoverDrinks,
  seenProductIds,
} from "../supabase/functions/_shared/next-drinks-domain";
import { parseDiscoveryResult } from "../src/features/discovery/contract";
import { discoveryPrefill } from "../src/features/discovery/prefill";
import {
  decodeWishlistOperation,
  parseWishlist,
} from "../src/features/discovery/wishlist";
const document = parseCatalogDocument({
  ...products.find((p) => p.id === "glenlivet-12")!,
  id: "synthetic-new-whisky",
  familyId: "synthetic-new",
  name: "합성 새 제품",
  aliases: ["Synthetic New"],
  baseAliases: ["Synthetic New"],
});
const product = catalogProduct(document);
const snapshot = {
  hash: "synthetic",
  totalRecords: 1,
  omittedCount: 0,
  records: [{
    id: "positive",
    entryId: "entry-positive",
    revision: 1,
    category: "whisky",
    name: "합성 느낌 기록",
    date: "2026-10-27",
    revisit: "again",
    rating: null,
    note: {
      mode: "light",
      version: 2,
      inputRevision: 1,
      confirmedInputRevision: 1,
      confirmed: true,
      answers: [{
        questionId: "nose",
        status: "answered",
        descriptorCodes: ["fruit"],
      }],
    },
  }],
};
function response() {
  return {
    catalog: [document],
    recommendations: discoverDrinks(snapshot, [], null, new Set(), [product]),
    wishlist: [],
    evidenceRecords: [{
      id: "positive",
      name: "합성 느낌 기록",
      category: "whisky",
      date: "2026-10-27",
      revision: 1,
      revisit: "again",
      noteText: null,
    }],
    tasteHash: snapshot.hash,
    recordCount: 1,
    sensoryRecordCount: 1,
    omittedSensoryRecords: 0,
    method: "evidence-rules-v1",
    modelUsed: false,
    catalogVersion: SHARED_CATALOG_VERSION,
    catalogSize: 1,
    limitedCatalog: true,
  };
}
test("dynamic product outside the bundled 32 flows through recommendation, reason facts, prefill and history exclusion", () => {
  assert.ok(!products.some((p) => p.id === product.id));
  const parsed = parseDiscoveryResult(response());
  assert.equal(parsed.recommendations[0].product.id, product.id);
  assert.deepEqual(parsed.catalog, [product]);
  assert.equal(
    discoveryPrefill(product.id, parsed.catalog)?.name,
    product.name,
  );
  assert.deepEqual([
    ...seenProductIds([{
      entered_name: product.name,
      category: "whisky",
      vintage_status: null,
      vintage_year: null,
    }], [product]),
  ], [product.id]);
  assert.deepEqual(
    discoverDrinks(snapshot, [], null, new Set([product.id]), [product]),
    [],
  );
  assert.deepEqual(
    discoverDrinks(
      { ...snapshot, records: [], totalRecords: 0 },
      [],
      null,
      new Set(),
      [product],
    ),
    [],
  );
});
test("dynamic transport rejects unsafe sources, mismatched recommendation facts, duplicate documents, size mismatch and unknown contract", () => {
  const base = response();
  for (
    const patch of [
      {
        catalog: [{
          ...document,
          source: { ...document.source, url: "https://127.0.0.1/private" },
        }],
      },
      { catalog: [document, document], catalogSize: 2 },
      { catalogSize: 32 },
      { catalogVersion: "future" },
      {
        recommendations: [{
          ...base.recommendations[0],
          product: { ...product, name: "Invented" },
        }],
      },
      { catalog: [{ ...document, features: [] }] },
    ]
  ) {
    assert.throws(
      () => parseDiscoveryResult({ ...base, ...patch }),
      /INVALID_DISCOVERY_RESPONSE/,
    );
  }
});
test("held/unavailable bookmark identity survives without exposing hidden facts; pending dynamic saves preserve owner and receipt checks", () => {
  const wishlist = [{ product_id: "synthetic-held", saved: true, revision: 2 }];
  assert.deepEqual(
    parseDiscoveryResult({ ...response(), wishlist }).wishlist,
    wishlist,
  );
  assert.deepEqual(
    parseWishlist([{ productId: product.id, saved: true, revision: 1 }]),
    [{ productId: product.id, saved: true, revision: 1 }],
  );
  const owner = "10000000-0000-4000-8000-000000000001";
  const operation = {
    version: 1,
    owner,
    operationId: "20000000-0000-4000-8000-000000000001",
    productId: product.id,
    saved: true,
    expectedRevision: 0,
  };
  assert.equal(
    decodeWishlistOperation(JSON.stringify(operation), owner).productId,
    product.id,
  );
  for (
    const patch of [{ productId: "../bad" }, {
      owner: "20000000-0000-4000-8000-000000000001",
    }, {
      receipt: {
        productId: product.id,
        saved: true,
        revision: 5,
        replayed: true,
      },
    }]
  ) {
    assert.throws(() =>
      decodeWishlistOperation(JSON.stringify({ ...operation, ...patch }), owner)
    );
  }
});
test("database row identity/status must match its document before use", () => {
  const row = {
    id: document.id,
    family_id: document.familyId,
    category: document.category,
    status: "verified",
    revision: 1,
    document,
  };
  assert.deepEqual(verifiedCatalogRow(row), document);
  for (
    const patch of [
      { id: "wrong" },
      { family_id: "wrong" },
      { category: "beer" },
      { status: "candidate" },
      { status: "held" },
      { revision: 0 },
    ]
  ) assert.throws(() => verifiedCatalogRow({ ...row, ...patch }));
});
