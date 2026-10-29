import {
  catalogProduct,
  isCatalogProductId,
  SHARED_CATALOG_VERSION,
  verifiedCatalogRow,
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
    body: { category, catalogVersion: SHARED_CATALOG_VERSION, ...(options.weekly ? { recommendationVersion: "weekly-selection-v1" } : {}) },
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
  return parseDiscoveryResult(data);
}

/** Route parameters contain IDs only; product facts are re-read under the initiating account's RLS. */
export async function loadDiscoveryPrefill(
  client: SupabaseClient,
  owner: string,
  productId: string,
) {
  if (!isCatalogProductId(productId)) throw new Error("INVALID_PRODUCT_ID");
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.from("product_catalog")
    .select("id,family_id,category,status,revision,document")
    .eq("id", productId).eq("status", "verified")
    .abortSignal(AbortSignal.timeout(20000)).maybeSingle();
  if (error || !data) throw new Error("CATALOG_PRODUCT_UNAVAILABLE");
  const product = catalogProduct(verifiedCatalogRow(data));
  if (product.id !== productId) throw new Error("INVALID_PRODUCT_ID");
  return discoveryPrefill(productId, [product]);
}
