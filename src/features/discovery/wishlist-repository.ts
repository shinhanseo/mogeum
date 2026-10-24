import type { SupabaseClient } from "@supabase/supabase-js";
import { menuClient } from "../menu/repository";
import {
  parseWishlist,
  parseWishlistReceipt,
  type WishlistOperation,
} from "./wishlist";
export async function applyWishlist(
  client: SupabaseClient,
  operation: WishlistOperation,
) {
  const scoped = await menuClient(client, operation.owner);
  const { data, error } = await scoped
    .rpc("set_drink_wishlist", {
      p_operation_id: operation.operationId,
      p_product_id: operation.productId,
      p_saved: operation.saved,
      p_expected_revision: operation.expectedRevision,
    })
    .abortSignal(AbortSignal.timeout(30000));
  if (error) {
    if (error.message === "STALE_WISHLIST")
      throw Object.assign(new Error("STALE_WISHLIST"), {
        code: "STALE_WISHLIST",
      });
    throw new Error("WISHLIST_SAVE_FAILED");
  }
  return parseWishlistReceipt(data, operation);
}
export async function loadWishlist(client: SupabaseClient, owner: string) {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped
    .from("drink_wishlist")
    .select("product_id,saved,revision")
    .eq("user_id", owner)
    .abortSignal(AbortSignal.timeout(30000));
  if (error || !data) throw new Error("WISHLIST_LOAD_FAILED");
  return parseWishlist(
    data.map((row) => ({
      productId: row.product_id,
      saved: row.saved,
      revision: row.revision,
    })),
  );
}
