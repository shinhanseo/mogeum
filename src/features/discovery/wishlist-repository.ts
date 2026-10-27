import { MAX_WISHLIST_ROWS } from "../../../supabase/functions/_shared/catalog-contract";
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
    if (["STALE_WISHLIST", "PRODUCT_NOT_VERIFIED"].includes(error.message)) {
      throw Object.assign(new Error(error.message), {
        code: error.message,
      });
    }
    throw new Error("WISHLIST_SAVE_FAILED");
  }
  return parseWishlistReceipt(data, operation);
}
export async function loadWishlist(client: SupabaseClient, owner: string) {
  const scoped = await menuClient(client, owner);
  const signal = AbortSignal.timeout(30000);
  const rows: { product_id: string; saved: boolean; revision: number }[] = [];
  let cursor: string | null = null;
  for (;;) {
    let query = scoped.from("drink_wishlist").select(
      "product_id,saved,revision",
    )
      .eq("user_id", owner).order("product_id").limit(200);
    if (cursor) query = query.gt("product_id", cursor);
    const { data, error } = await query.abortSignal(signal);
    if (error || !data) throw new Error("WISHLIST_LOAD_FAILED");
    rows.push(...data);
    if (rows.length > MAX_WISHLIST_ROWS) {
      throw new Error("WISHLIST_LOAD_FAILED");
    }
    if (data.length < 200) break;
    cursor = data.at(-1)!.product_id;
  }
  return parseWishlist(
    rows.map((row) => ({
      productId: row.product_id,
      saved: row.saved,
      revision: row.revision,
    })),
  );
}
