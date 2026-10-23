import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  parseMenu,
  PRODUCT_CATALOG_VERSION,
  products,
  validatePhotos,
  validateItems,
  recommendMenu,
} from "../_shared/menu-domain.ts";
import type { TasteSnapshot } from "../_shared/taste-domain.ts";
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
    headers: { ...cors, "Cache-Control": "no-store" },
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
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return reply({ code: "UNAUTHENTICATED" }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 600000) return reply({ code: "TOO_LARGE" }, 413);
    const body = JSON.parse(raw);
    const photos = validatePhotos(body.photos);
    if (body.action === "parse")
      return reply({
        items: parseMenu(photos),
        parser: "geometry-v1",
        catalogVersion: PRODUCT_CATALOG_VERSION,
        reviewRequired: true,
      });
    if (body.action !== "recommend")
      return reply({ code: "INVALID_ACTION" }, 400);
    const items = validateItems(body.items, photos);
    if (!items.length || items.some((i) => !i.confirmed))
      return reply({ code: "CONFIRM_MENU" }, 400);
    const { data, error } = await client.rpc("taste_summary_context");
    if (error) throw error;
    const snapshot = data.snapshot as TasteSnapshot;
    const recommendations = recommendMenu(items, snapshot);
    const evidenceIds = new Set(
      recommendations.flatMap((r) => [
        ...r.similar.flatMap((f) => [...f.recordIds, ...f.negativeIds]),
        ...r.knownRecordIds,
      ]),
    );
    const evidenceRecords = snapshot.records
      .filter((r) => evidenceIds.has(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        revision: r.revision,
        category: r.category,
        revisit: r.revisit,
        noteText: r.note?.text ?? null,
      }));
    return reply({
      recommendations,
      evidenceRecords,
      tasteHash: snapshot.hash,
      recordCount: snapshot.totalRecords,
      method: "evidence-rules-v1",
      limitedCatalog: true,
      catalogVersion: PRODUCT_CATALOG_VERSION,
      catalogSize: products.length,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return reply(
      { code: /^(INVALID_|TOO_LARGE)/.test(code) ? code : "MENU_FAILED" },
      400,
    );
  }
});
