import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "../../../supabase/functions/_shared/product-catalog";
import { menuClient } from "../menu/repository";
import { parseDiscoveryResult, type DiscoveryResult } from "./contract";

/** The operation keeps the initiating account's JWT even if the app session changes. */
export async function loadDiscovery(
  client: SupabaseClient,
  owner: string,
  category: Product["category"] | null = null,
): Promise<DiscoveryResult> {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.functions.invoke("next-drinks", {
    body: { category },
    timeout: 30000,
  });
  if (error) {
    let changed = false;
    try {
      const response = (error as { context?: Response }).context;
      if (response?.status === 409)
        changed = (await response.json()).code === "TASTE_CONTEXT_CHANGED";
    } catch {
      // Do not surface untrusted response text or confuse a transport failure with a stale snapshot.
    }
    throw Object.assign(new Error("NEXT_DRINKS_UNAVAILABLE"), {
      code: changed ? "TASTE_CONTEXT_CHANGED" : "NEXT_DRINKS_UNAVAILABLE",
    });
  }
  return parseDiscoveryResult(data);
}
