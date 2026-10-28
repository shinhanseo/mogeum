import {generateWeeklySelection} from './weekly-service.ts';
import {restoreWeeklyDrinks,WEEKLY_DISCOVERY_VERSION} from '../_shared/weekly-discovery.ts';
import {
  DiscoverySnapshotChanged,
  withStableDiscoverySnapshot,
} from "../_shared/discovery-snapshot.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { MenuBodyTooLargeError, readMenuBody } from "../_shared/menu-body.ts";
import {
  discoverDrinks,
  type DrinkHistory,
  seenProductIds,
} from "../_shared/next-drinks-domain.ts";
import {
  type Product,
  PRODUCT_CATALOG_VERSION,
  products,
} from "../_shared/product-catalog.ts";
import {
  type CatalogDocument,
  catalogProduct,
  MAX_CATALOG_PRODUCTS,
  MAX_WISHLIST_ROWS,
  SHARED_CATALOG_VERSION,
  verifiedCatalogRow,
} from "../_shared/catalog-contract.ts";
import { analyzeTaste, type TasteSnapshot } from "../_shared/taste-domain.ts";
declare const __MOGEUM_BUILD_ID__: string | undefined;
const buildId = typeof __MOGEUM_BUILD_ID__ === "string"
  ? __MOGEUM_BUILD_ID__
  : "source-development";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Mogeum-Build": buildId,
    },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (request.method !== "POST") {
    return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  }
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return reply({ code: "UNAUTHENTICATED" }, 401);
  try {
    const signal = AbortSignal.timeout(25000);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ??
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) => fetch(input, { ...init, signal }),
        },
      },
    );
    const auth = await client.auth.getUser(token);
    if (auth.error || !auth.data.user) {
      return reply({ code: "UNAUTHENTICATED" }, 401);
    }
    let body: unknown;
    try {
      body = JSON.parse(await readMenuBody(request, 2048));
    } catch (error) {
      if (error instanceof MenuBodyTooLargeError) {
        return reply({ code: "TOO_LARGE" }, 413);
      }
      return reply({ code: "INVALID_REQUEST" }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== "category" && k !== "catalogVersion" && k !== "recommendationVersion")
    ) {
      return reply({ code: "INVALID_REQUEST" }, 400);
    }
    const category = (body as { category?: unknown }).category ?? null;
    if (
      category !== null &&
      !new Set(["whisky", "beer", "wine", "traditional"]).has(
        category as string,
      )
    ) {
      return reply({ code: "INVALID_CATEGORY" }, 400);
    }
    const requestedCatalog =
      (body as { catalogVersion?: unknown }).catalogVersion;
    if (
      requestedCatalog !== undefined &&
      requestedCatalog !== SHARED_CATALOG_VERSION
    ) {
      return reply({ code: "INVALID_CATALOG_VERSION" }, 400);
    }
    const dynamic = requestedCatalog === SHARED_CATALOG_VERSION;
    const weeklyVersion=(body as {recommendationVersion?:unknown}).recommendationVersion;
    if(weeklyVersion!==undefined&&(weeklyVersion!==WEEKLY_DISCOVERY_VERSION||!dynamic))return reply({code:'INVALID_RECOMMENDATION_VERSION'},400);
    const weekly=weeklyVersion===WEEKLY_DISCOVERY_VERSION;
    const owner = auth.data.user.id;
    const result = await withStableDiscoverySnapshot(
      async () => {
        const context = await client.rpc("taste_summary_context");
        if (context.error || !context.data?.snapshot) {
          throw new Error("CONTEXT_FAILED");
        }
        return context.data.snapshot as TasteSnapshot;
      },
      async (snapshot) => {
        const catalog: CatalogDocument[] = [];
        // Stable ID pagination avoids PostgREST's default 1000-row truncation.
        let productCursor: string | null = null;
        for (;;) {
          let query = client.from("product_catalog")
            .select("id,family_id,category,status,revision,document")
            .eq("status", "verified").order("id").limit(200);
          if (productCursor) query = query.gt("id", productCursor);
          const page = await query;
          if (page.error) throw new Error("CATALOG_FAILED");
          catalog.push(...(page.data ?? []).map(verifiedCatalogRow));
          if (catalog.length > MAX_CATALOG_PRODUCTS) {
            throw new Error("CATALOG_TOO_LARGE");
          }
          if (!page.data || page.data.length < 200) break;
          productCursor = page.data.at(-1)!.id;
        }
        // Legacy binaries require their pinned facts. Keep this compatibility view read-only;
        // new clients explicitly opt into the authenticated dynamic catalog contract.
        const availableProducts = dynamic
          ? catalog.map(catalogProduct)
          : products.filter((p) => catalog.some((doc) => doc.id === p.id));
        const wishlist: {
          product_id: string;
          saved: boolean;
          revision: number;
        }[] = [];
        let wishCursor: string | null = null;
        for (;;) {
          let query = client.from("drink_wishlist")
            .select("product_id,saved,revision").eq("user_id", owner)
            .order("product_id").limit(200);
          if (wishCursor) query = query.gt("product_id", wishCursor);
          const page = await query;
          if (page.error) throw new Error("WISHLIST_FAILED");
          wishlist.push(...(page.data ?? []));
          if (wishlist.length > MAX_WISHLIST_ROWS) {
            throw new Error("WISHLIST_TOO_LARGE");
          }
          if (!page.data || page.data.length < 200) break;
          wishCursor = page.data.at(-1)!.product_id;
        }
        const history: DrinkHistory[] = [],
          known = new Set<string>();
        let cursor: string | null = null;
        for (;;) {
          let query = client
            .from("tasting_records")
            .select("id,entered_name,category,vintage_status,vintage_year")
            .eq("user_id", owner)
            .order("id")
            .limit(200);
          if (cursor) query = query.gt("id", cursor);
          const page = await query;
          if (page.error) throw new Error("HISTORY_FAILED");
          for (const row of page.data ?? []) {
            const ids = seenProductIds([row], availableProducts);
            if ([...ids].some((id) => !known.has(id))) {
              history.push(row);
              for (const id of ids) known.add(id);
            }
          }
          if (!page.data || page.data.length < 200) break;
          cursor = page.data.at(-1)!.id;
        }
        let recommendations = discoverDrinks(
          snapshot,
          history,
          category as Product["category"] | null,
          new Set(wishlist.filter((r) => r.saved).map((r) => r.product_id)),
          availableProducts,
        );
        let generation:Record<string,unknown>|undefined;
        if(weekly){
          const eligible=discoverDrinks(snapshot,history,null,new Set(wishlist.filter(r=>r.saved).map(r=>r.product_id)),availableProducts);
          if(!eligible.length){recommendations=[];generation={state:'insufficient'};}
          else {
            const key=Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            if(!key||!serviceKey)throw Error('WEEKLY_AI_NOT_CONFIGURED');
            const admin=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal})}});
            const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshot.hash));
            const generationHash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
            const generated=await generateWeeklySelection(admin,{owner,hash:generationHash,eligible,unchanged:async()=>{
              const current=await client.rpc('taste_summary_context');
              if(current.error||!current.data?.snapshot)throw Error('CONTEXT_FAILED');
              return current.data.snapshot.hash===snapshot.hash;
            }},{apiKey:key,model:Deno.env.get('GEMINI_MODEL')??'gemini-3.5-flash-lite'});
            generation={state:generated.state,...('generatedAt' in generated?{generatedAt:generated.generatedAt}:{}),...('nextGenerationAt' in generated?{nextGenerationAt:generated.nextGenerationAt}:{})};
            recommendations='result' in generated?restoreWeeklyDrinks(generated.result,snapshot,history,new Set(wishlist.filter(r=>r.saved).map(r=>r.product_id)),availableProducts,category as Product['category']|null):[];
          }
        }
        if(weekly){
          const currentCatalog:CatalogDocument[]=[];let after:string|null=null;
          for(;;){
            let query=client.from('product_catalog').select('id,family_id,category,status,revision,document').eq('status','verified').order('id').limit(200);
            if(after)query=query.gt('id',after);const page=await query;
            if(page.error)throw Error('CATALOG_FAILED');currentCatalog.push(...(page.data??[]).map(verifiedCatalogRow));
            if(currentCatalog.length>MAX_CATALOG_PRODUCTS)throw Error('CATALOG_TOO_LARGE');
            if(!page.data||page.data.length<200)break;after=page.data.at(-1)!.id;
          }
          const currentWishlist:typeof wishlist=[];after=null;
          for(;;){
            let query=client.from('drink_wishlist').select('product_id,saved,revision').eq('user_id',owner).order('product_id').limit(200);
            if(after)query=query.gt('product_id',after);const page=await query;
            if(page.error)throw Error('WISHLIST_FAILED');currentWishlist.push(...(page.data??[]));
            if(currentWishlist.length>MAX_WISHLIST_ROWS)throw Error('WISHLIST_TOO_LARGE');
            if(!page.data||page.data.length<200)break;after=page.data.at(-1)!.product_id;
          }
          if(JSON.stringify(currentCatalog)!==JSON.stringify(catalog)||JSON.stringify(currentWishlist)!==JSON.stringify(wishlist))throw new DiscoverySnapshotChanged();
        }
        const evidenceIds = new Set(
          recommendations.flatMap((r) =>
            [...r.similar, ...r.cautions].flatMap((f) => [
              ...f.recordIds,
              ...f.negativeIds,
            ])
          ),
        );
        return {
          recommendations,
          wishlist: dynamic
            ? wishlist
            : wishlist.filter((r) =>
              products.some((p) => p.id === r.product_id)
            ),
          ...(dynamic ? { catalog } : {}),
          evidenceRecords: snapshot.records
            .filter((r) => evidenceIds.has(r.id))
            .map((r) => ({
              id: r.id,
              name: r.name,
              category: r.category,
              date: r.date,
              revision: r.revision,
              revisit: r.revisit,
              noteText: r.note?.text ?? null,
            })),
          tasteHash: snapshot.hash,
          recordCount: snapshot.totalRecords,
          sensoryRecordCount: analyzeTaste(snapshot).recordCount,
          omittedSensoryRecords: snapshot.omittedCount,
          method: weekly?'gemini-weekly-selection-v1':"evidence-rules-v1",
          modelUsed: weekly&&!!generation&&['cached','generated'].includes(String(generation.state)),
          ...(weekly?{generation}:{}),
          catalogVersion: dynamic
            ? SHARED_CATALOG_VERSION
            : PRODUCT_CATALOG_VERSION,
          catalogSize: dynamic ? catalog.length : products.length,
          limitedCatalog: true,
        };
      },
    );
    return reply(result);
  } catch (error) {
    if (error instanceof DiscoverySnapshotChanged) {
      return reply({ code: "TASTE_CONTEXT_CHANGED" }, 409);
    }
    const code=error instanceof Error?error.message:'';
    if(code==='TASTE_CONTEXT_CHANGED')return reply({code},409);
    if(code==='WEEKLY_AI_NOT_CONFIGURED')return reply({code:'AI_NOT_CONFIGURED'},503);
    return reply({ code: "NEXT_DRINKS_UNAVAILABLE" }, 503);
  }
});
