import { SHARED_CATALOG_VERSION, verifiedCatalogRow, catalogProduct, MAX_CATALOG_PRODUCTS } from "../../../supabase/functions/_shared/catalog-contract";
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
  requireCatalogVersion, menuCatalog,
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
  options: { gemini?: boolean; research?: boolean } = {},
): Promise<{ items: MenuItem[]; catalog: import("../../../supabase/functions/_shared/product-catalog").Product[] } | MenuResult> {
  validatePhotos(photos);
  if (items) validateItems(items, photos, "stored");
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.functions.invoke("menu-recommend", {
    body: { action: items ? "recommend" : "parse", photos, items, catalogVersion: SHARED_CATALOG_VERSION, ...(items && options.gemini ? {recommendationVersion: "menu-selection-v1"} : {}), ...(items && options.research ? {researchVersion:"menu-research-v1"} : {}) },
    timeout: options.research ? 85000 : 50000,
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
  const catalog=menuCatalog(data);
  return { items: validateItems(data?.items, photos, "catalog", false, catalog), catalog };
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

export async function loadMenuCatalog(client: SupabaseClient, owner: string) {
 const scoped=await menuClient(client,owner), signal=AbortSignal.timeout(20000);
 const catalog: import("../../../supabase/functions/_shared/product-catalog").Product[]=[];
 let cursor:string|null=null;
 for(;;){
  let query=scoped.from("product_catalog").select("id,family_id,category,status,revision,document").eq("status","verified").order("id").limit(200);
  if(cursor)query=query.gt("id",cursor);
  const {data,error}=await query.abortSignal(signal);
  if(error||!data)throw new Error("MENU_CATALOG_UNAVAILABLE");
  catalog.push(...data.map(row=>catalogProduct(verifiedCatalogRow(row))));
  if(catalog.length>MAX_CATALOG_PRODUCTS)throw new Error("MENU_CATALOG_UNAVAILABLE");
  if(data.length<200)break;
  cursor=data.at(-1)!.id;
 }
 return catalog;
}
