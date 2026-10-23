import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBackendState } from "../../lib/env";
import {
  validatePhotos,
  validateItems,
  type MenuPhoto,
  type MenuItem,
  type MenuRecommendation,
} from "../../../supabase/functions/_shared/menu-domain";
export type MenuResult = {
  evidenceRecords: {
    id: string;
    name: string | null;
    date: string;
    revision: number;
  }[];
  recommendations: MenuRecommendation[];
  tasteHash: string;
  recordCount: number;
  method: string;
  limitedCatalog: boolean;
};
/** Pin the verified owner/token for all calls in this operation. */
export async function menuClient(client: SupabaseClient, owner: string) {
  const { data } = await client.auth.getSession();
  const session = data.session;
  const state = getBackendState();
  if (!session || session.user.id !== owner || !state.configured)
    throw new Error("UNAUTHENTICATED");
  return createClient(state.config.url, state.config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}
export async function menuRequest(
  client: SupabaseClient,
  owner: string,
  photos: MenuPhoto[],
  items?: MenuItem[],
): Promise<{ items: MenuItem[] } | MenuResult> {
  validatePhotos(photos);
  if (items) validateItems(items, photos);
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.functions.invoke("menu-recommend", {
    body: { action: items ? "recommend" : "parse", photos, items },
  });
  if (error) throw new Error("MENU_SERVICE_UNAVAILABLE");
  if (items) {
    if (
      !Array.isArray(data?.evidenceRecords) ||
      !Array.isArray(data?.recommendations) ||
      typeof data.tasteHash !== "string"
    )
      throw new Error("INVALID_RESULT");
    const ids = new Set(items.map((i) => i.id));
    if (
      data.recommendations.some((r: MenuRecommendation) => !ids.has(r.itemId))
    )
      throw new Error("INVALID_RESULT");
    return data as MenuResult;
  }
  return { items: validateItems(data?.items, photos) };
}
export async function saveMenuSession(
  client: SupabaseClient,
  owner: string,
  id: string,
  revision: number,
  photos: MenuPhoto[],
  items: MenuItem[],
) {
  validatePhotos(photos);
  validateItems(items, photos);
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.rpc("save_menu_session", {
    p_id: id,
    p_revision: revision,
    p_photos: photos,
    p_items: items,
  });
  if (error) throw error;
  if (!Number.isInteger(data)) throw new Error("INVALID_REVISION");
  return data as number;
}
