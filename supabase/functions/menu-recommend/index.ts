import { type CatalogDocument, MAX_CATALOG_PRODUCTS, SHARED_CATALOG_VERSION, verifiedCatalogRow, catalogProduct } from "../_shared/catalog-contract.ts";
import { stableMenuRecommendation } from "../_shared/menu-recommendation.ts";
import { DiscoverySnapshotChanged } from "../_shared/discovery-snapshot.ts";
import { readMenuBody, MenuBodyTooLargeError } from "../_shared/menu-body.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  parseMenu,
  PRODUCT_CATALOG_VERSION,
  validatePhotos,
  validateItems,
} from "../_shared/menu-domain.ts";
import type { TasteSnapshot } from "../_shared/taste-domain.ts";
declare const __MOGEUM_BUILD_ID__: string | undefined;
const buildId =
  typeof __MOGEUM_BUILD_ID__ === "string"
    ? __MOGEUM_BUILD_ID__
    : "source-development";
const url = Deno.env.get("SUPABASE_URL")!;
const key =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Mogeum-Build": buildId,
    },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return reply({ code: "UNAUTHENTICATED" }, 401);
  const signal = AbortSignal.timeout(25000);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, {...init, signal}) },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return reply({ code: "UNAUTHENTICATED" }, 401);
  try {
    const raw = await readMenuBody(request);
    const body = JSON.parse(raw);
    if (body.catalogVersion !== undefined && body.catalogVersion !== SHARED_CATALOG_VERSION)
      return reply({code:"INVALID_CATALOG_VERSION"},400);
    let catalog: CatalogDocument[] | undefined;
    if(body.catalogVersion === SHARED_CATALOG_VERSION){
      catalog=[]; let cursor: string | null=null;
      for(;;){
        let query=client.from("product_catalog").select("id,family_id,category,status,revision,document")
          .eq("status","verified").order("id").limit(200);
        if(cursor)query=query.gt("id",cursor);
        const page=await query;
        if(page.error)throw new Error("CATALOG_FAILED");
        catalog.push(...(page.data??[]).map(verifiedCatalogRow));
        if(catalog.length>MAX_CATALOG_PRODUCTS)throw new Error("CATALOG_TOO_LARGE");
        if(!page.data||page.data.length<200)break;
        cursor=page.data.at(-1)!.id;
      }
    }
    const photos = validatePhotos(body.photos);
    if (body.action === "parse")
      return reply({
        items: parseMenu(photos, catalog?.map(catalogProduct)),
        ...(catalog ? {catalog} : {}),
        parser: "geometry-v5",
        catalogVersion: catalog ? SHARED_CATALOG_VERSION : PRODUCT_CATALOG_VERSION,
        reviewRequired: true,
      });
    if (body.action !== "recommend")
      return reply({ code: "INVALID_ACTION" }, 400);
    const items = validateItems(body.items, photos, "catalog", false, catalog?.map(catalogProduct));
    if (!items.length || items.some((i) => !i.confirmed))
      return reply({ code: "CONFIRM_MENU" }, 400);
    const result = await stableMenuRecommendation(items, async () => {
      const { data, error } = await client.rpc("taste_summary_context");
      if (error) throw error;
      return data.snapshot as TasteSnapshot;
    }, catalog);
    return reply(result);
  } catch (error) {
    if (error instanceof DiscoverySnapshotChanged)
      return reply({ code: "MENU_EVIDENCE_STALE" }, 409);
    const code = error instanceof Error ? error.message : "";
    return reply(
      {
        code:
          /^(INVALID_|TOO_LARGE)/.test(code) || code === "MENU_ITEM_LIMIT"
            ? code
            : "MENU_FAILED",
      },
      error instanceof MenuBodyTooLargeError ? 413 : 400,
    );
  }
});
