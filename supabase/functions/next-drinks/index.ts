import {
  DiscoverySnapshotChanged,
  withStableDiscoverySnapshot,
} from "../_shared/discovery-snapshot.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { readMenuBody, MenuBodyTooLargeError } from "../_shared/menu-body.ts";
import {
  discoverDrinks,
  seenProductIds,
  type DrinkHistory,
} from "../_shared/next-drinks-domain.ts";
import {
  products,
  PRODUCT_CATALOG_VERSION,
  type Product,
} from "../_shared/product-catalog.ts";
import { analyzeTaste, type TasteSnapshot } from "../_shared/taste-domain.ts";
declare const __MOGEUM_BUILD_ID__: string | undefined;
const buildId =
  typeof __MOGEUM_BUILD_ID__ === "string"
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
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
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
    if (auth.error || !auth.data.user)
      return reply({ code: "UNAUTHENTICATED" }, 401);
    let body: unknown;
    try {
      body = JSON.parse(await readMenuBody(request, 2048));
    } catch (error) {
      if (error instanceof MenuBodyTooLargeError)
        return reply({ code: "TOO_LARGE" }, 413);
      return reply({ code: "INVALID_REQUEST" }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== "category")
    )
      return reply({ code: "INVALID_REQUEST" }, 400);
    const category = (body as { category?: unknown }).category ?? null;
    if (
      category !== null &&
      !new Set(["whisky", "beer", "wine", "traditional"]).has(
        category as string,
      )
    )
      return reply({ code: "INVALID_CATEGORY" }, 400);
    const owner = auth.data.user.id;
    const result = await withStableDiscoverySnapshot(
      async () => {
        const context = await client.rpc("taste_summary_context");
        if (context.error || !context.data?.snapshot)
          throw new Error("CONTEXT_FAILED");
        return context.data.snapshot as TasteSnapshot;
      },
      async (snapshot) => {
        const wishlist = await client
          .from("drink_wishlist")
          .select("product_id,saved,revision")
          .eq("user_id", owner)
          .order("product_id");
        if (wishlist.error) throw new Error("WISHLIST_FAILED");
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
            const ids = seenProductIds([row]);
            if ([...ids].some((id) => !known.has(id))) {
              history.push(row);
              for (const id of ids) known.add(id);
            }
          }
          if (!page.data || page.data.length < 200) break;
          cursor = page.data.at(-1)!.id;
        }
        const recommendations = discoverDrinks(
          snapshot,
          history,
          category as Product["category"] | null,
          new Set((wishlist.data ?? []).filter((r) => r.saved).map((r) => r.product_id)),
        );
        const evidenceIds = new Set(
          recommendations.flatMap((r) =>
            [...r.similar, ...r.cautions].flatMap((f) => [
              ...f.recordIds,
              ...f.negativeIds,
            ]),
          ),
        );
        return {
          recommendations,
          wishlist: wishlist.data ?? [],
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
          method: "evidence-rules-v1",
          modelUsed: false,
          catalogVersion: PRODUCT_CATALOG_VERSION,
          catalogSize: products.length,
          limitedCatalog: true,
        };
      },
    );
    return reply(result);
  } catch (error) {
    if (error instanceof DiscoverySnapshotChanged)
      return reply({ code: "TASTE_CONTEXT_CHANGED" }, 409);
    return reply({ code: "NEXT_DRINKS_UNAVAILABLE" }, 503);
  }
});
