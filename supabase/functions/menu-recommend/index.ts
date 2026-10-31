import {researchMenu} from "./research-service.ts";
import {MENU_RESEARCH_VERSION,type MenuResearchBatch} from "../_shared/menu-research.ts";
import {selectMenu} from "./selection-service.ts";
import {menuSelectionCandidates} from "../_shared/menu-selection.ts";
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
  const signal = AbortSignal.timeout(75000);
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
    if (body.recommendationVersion !== undefined && (body.recommendationVersion !== "menu-selection-v1" || body.catalogVersion !== SHARED_CATALOG_VERSION))
      return reply({code:"INVALID_RECOMMENDATION_VERSION"},400);
    if(body.researchVersion!==undefined&&(body.researchVersion!==MENU_RESEARCH_VERSION||body.catalogVersion!==SHARED_CATALOG_VERSION))return reply({code:"INVALID_RESEARCH_VERSION"},400);
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
    let research:MenuResearchBatch|undefined;
    if(body.researchVersion===MENU_RESEARCH_VERSION&&catalog&&items.some(i=>i.productId===null)){
      const apiKey=Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),model=Deno.env.get("MOGEUM_RESEARCH_MODEL");
      if(apiKey&&serviceKey&&model&&catalog.length<=MAX_CATALOG_PRODUCTS-2){
        const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal})}});
        try{research=await researchMenu(admin,auth.user.id,items,{apiKey,model});}catch{/* Preserve the existing comparison when research is unavailable. */}
      }
      research??={entries:items.filter(i=>i.productId===null).map(i=>({itemId:i.id,state:"unavailable",productId:null})),documents:[]};
    }
    const resolvedItems=items.map(item=>({...item,productId:item.productId??research?.entries.find(e=>e.itemId===item.id&&e.state==="compared")?.productId??null}));
    const comparisonCatalog=catalog&&[...catalog,...(research?.documents??[])];
    const result = await stableMenuRecommendation(resolvedItems, async () => {
      const { data, error } = await client.rpc("taste_summary_context");
      if (error) throw error;
      return data.snapshot as TasteSnapshot;
    }, comparisonCatalog, !research&&body.recommendationVersion === "menu-selection-v1" ? async (rows, snapshot) => {
      if (!menuSelectionCandidates(rows).length) return {recommendations: rows, modelUsed: false, state: "insufficient"};
      const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), model = Deno.env.get("GEMINI_MODEL");
      if (!apiKey || !serviceKey || !model) return {recommendations: rows, modelUsed: false, state: "unavailable"};
      // Hash every menu/edition/fact/evidence change; cache stores selected IDs only.
      const bytes = new TextEncoder().encode(JSON.stringify({tasteHash:snapshot.hash,items,catalog,rows}));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), n=>n.toString(16).padStart(2,"0")).join("");
      const admin = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal})}});
      try {return await selectMenu(admin,{owner:auth.user.id,hash,rows},{apiKey,model});}
      catch {return {recommendations:rows,modelUsed:false,state:"unavailable"};}
    } : undefined);
    return reply({...result,...(research?{researchVersion:MENU_RESEARCH_VERSION,research:research.entries}:{} )});
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
