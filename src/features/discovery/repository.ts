import {catalogDocuments} from "../../../supabase/functions/_shared/catalog-database";
import {
  catalogProduct,
  isCatalogProductId,
  RICH_CATALOG_VERSION,
} from "../../../supabase/functions/_shared/catalog-contract";
import { discoveryPrefill } from "./prefill";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "../../../supabase/functions/_shared/product-catalog";
import { menuClient } from "../menu/repository";
import { type DiscoveryResult, parseDiscoveryResult } from "./contract";

/** The operation keeps the initiating account's JWT even if the app session changes. */
export async function loadDiscovery(
  client: SupabaseClient,
  owner: string,
  category: Product["category"] | null = null,
  options: { weekly?: boolean } = {},
): Promise<DiscoveryResult> {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.functions.invoke("next-drinks", {
    body: { category, catalogVersion: RICH_CATALOG_VERSION, ...(options.weekly ? { recommendationVersion: "weekly-selection-v1" } : {}) },
    timeout: 30000,
  });
  if (error) {
    let changed = false;
    try {
      const response = (error as { context?: Response }).context;
      if (response?.status === 409) {
        changed = (await response.json()).code === "TASTE_CONTEXT_CHANGED";
      }
    } catch {
      // Do not surface untrusted response text or confuse a transport failure with a stale snapshot.
    }
    throw Object.assign(new Error("NEXT_DRINKS_UNAVAILABLE"), {
      code: changed ? "TASTE_CONTEXT_CHANGED" : "NEXT_DRINKS_UNAVAILABLE",
    });
  }
  const result = parseDiscoveryResult(data);
  const missing = result.wishlist.filter(row => row.saved && !result.catalog.some(product => product.id === row.product_id)).map(row => row.product_id);
  const extra = await catalogDocuments(scoped, missing);
  return {...result, catalog: [...result.catalog, ...extra.map(catalogProduct)]};
}

/** Route parameters contain IDs only; product facts are re-read under the initiating account's RLS. */
export async function loadDiscoveryPrefill(
  client: SupabaseClient,
  owner: string,
  productId: string,
) {
  if (!isCatalogProductId(productId)) throw new Error("INVALID_PRODUCT_ID");
  const scoped = await menuClient(client, owner);
  const documents = await catalogDocuments(scoped, [productId]);
  if (!documents.length) throw new Error("CATALOG_PRODUCT_UNAVAILABLE");
  const product = catalogProduct(documents[0]);
  if (product.id !== productId) throw new Error("INVALID_PRODUCT_ID");
  return discoveryPrefill(productId, [product]);
}
