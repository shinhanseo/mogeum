import { refreshMenuEvidence } from "./evidence";
import { tastePhotoUrls } from "../taste/repository";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBackendState } from "../../lib/env";
import {
  validatePhotos,
  validateItems,
  type MenuPhoto,
  type MenuItem,
} from "../../../supabase/functions/_shared/menu-domain";
import {
  requireCatalogVersion,
  validateMenuResult,
  type MenuResult,
} from "./result-contract";
export type { MenuResult } from "./result-contract";
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
    timeout: 30000,
  });
  if (error) {
    let code: unknown;
    try {
      const response = (error as { context?: Response }).context;
      code = response ? (await response.json())?.code : undefined;
    } catch {
      /* Never expose remote exception text. */
    }
    throw new Error(
      code === "MENU_EVIDENCE_STALE"
        ? "MENU_EVIDENCE_STALE"
        : code === "MENU_ITEM_LIMIT"
          ? "MENU_ITEM_LIMIT"
          : "MENU_SERVICE_UNAVAILABLE",
    );
  }
  requireCatalogVersion(data);
  if (items) return validateMenuResult(data, items);
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
  validateItems(items, photos, "stored");
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped
    .rpc("save_menu_session", {
      p_id: id,
      p_revision: revision,
      p_photos: photos,
      p_items: items,
    })
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
  if (!Number.isInteger(data)) throw new Error("INVALID_REVISION");
  return data as number;
}

export async function loadMenuEvidence(
  client: SupabaseClient,
  owner: string,
  result: MenuResult,
  active: () => boolean,
) {
  const scoped = await menuClient(client, owner);
  return refreshMenuEvidence(result.tasteHash, {
    active,
    async hash() {
      const { data, error } = await scoped
        .rpc("taste_summary_context")
        .abortSignal(AbortSignal.timeout(20000));
      if (error) throw error;
      return data?.snapshot?.hash;
    },
    photos: () =>
      tastePhotoUrls(
        scoped,
        owner,
        result.evidenceRecords.map((r) => r.id),
      ),
  });
}
