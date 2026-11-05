import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { bartenderHandler } from "../_shared/bartender-handler.ts";
import {
  catalogProduct,
  verifiedCatalogRow,
  MAX_CATALOG_PRODUCTS,
} from "../_shared/catalog-contract.ts";
import type { TasteSnapshot } from "../_shared/taste-domain.ts";
import type { DrinkHistory } from "../_shared/next-drinks-domain.ts";
import { budgetedProductResearch } from "../product-research/service.ts";
import { reviewResearchSources } from "../_shared/source-review.ts";
import { researchedMenuDocument } from "../_shared/menu-research.ts";
import { converse } from "./provider.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  publicKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
  secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  key = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const client = createClient(url, publicKey, options),
  admin = secret
    ? createClient(url, secret, {
        ...options,
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
        },
      })
    : null;
async function rpc(name: string, args: Record<string, unknown>) {
  if (!admin) throw Error("NOT_CONFIGURED");
  const { data, error } = await admin.rpc(name, args);
  if (error) throw Error("BARTENDER_DB_FAILED");
  return data;
}
Deno.serve(
  bartenderHandler({
    async authenticate(token) {
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user;
    },
    configured: () => Boolean(key && admin),
    begin: (owner, operation, hash, revision) =>
      rpc("begin_bartender_turn", {
        p_owner: owner,
        p_operation: operation,
        p_hash: hash,
        p_revision: revision,
      }),
    finish: (owner, operation, hash, document, result, input, output) =>
      rpc("finish_bartender_turn", {
        p_owner: owner,
        p_operation: operation,
        p_hash: hash,
        p_document: document,
        p_result: result,
        p_input_tokens: input,
        p_output_tokens: output,
      }),
    async context(token) {
      const scoped = createClient(url, publicKey, {
        ...options,
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
        },
      });
      const { data, error } = await scoped.rpc("taste_summary_context");
      if (error || !data?.snapshot) throw Error("CONTEXT_FAILED");
      const snapshot = data.snapshot as TasteSnapshot;
      const catalog = [];
      let cursor: string | null = null;
      for (;;) {
        let q = scoped
          .from("product_catalog")
          .select("id,family_id,category,status,revision,document")
          .eq("status", "verified")
          .order("id")
          .limit(200);
        if (cursor) q = q.gt("id", cursor);
        const page = await q;
        if (page.error) throw Error("CATALOG_FAILED");
        catalog.push(
          ...(page.data ?? []).map((row) =>
            catalogProduct(verifiedCatalogRow(row)),
          ),
        );
        if (catalog.length > MAX_CATALOG_PRODUCTS)
          throw Error("CATALOG_TOO_LARGE");
        if (!page.data || page.data.length < 200) break;
        cursor = page.data.at(-1)!.id;
      }
      const saved = new Set<string>();
      cursor = null;
      for (;;) {
        let q = scoped
          .from("drink_wishlist")
          .select("product_id")
          .eq("saved", true)
          .order("product_id")
          .limit(200);
        if (cursor) q = q.gt("product_id", cursor);
        const page = await q;
        if (page.error) throw Error("WISHLIST_FAILED");
        for (const r of page.data ?? []) saved.add(r.product_id);
        if (saved.size > 10000) throw Error("WISHLIST_TOO_LARGE");
        if (!page.data || page.data.length < 200) break;
        cursor = page.data.at(-1)!.product_id;
      }
      const history: DrinkHistory[] = [];
      cursor = null;
      for (;;) {
        let q = scoped
          .from("tasting_records")
          .select("id,entered_name,category,vintage_status,vintage_year")
          .order("id")
          .limit(200);
        if (cursor) q = q.gt("id", cursor);
        const page = await q;
        if (page.error) throw Error("HISTORY_FAILED");
        history.push(...(page.data ?? []));
        if (history.length > 10000) throw Error("HISTORY_TOO_LARGE");
        if (!page.data || page.data.length < 200) break;
        cursor = page.data.at(-1)!.id;
      }
      return { snapshot, catalog, history, saved };
    },
    converse: (input, signal) => converse(input, key!, signal),
    async research(query) {
      const model = Deno.env.get("MOGEUM_RESEARCH_MODEL")?.trim();
      if (!admin || !key || !model)
        return { product: null, state: "unavailable" };
      const result = await budgetedProductResearch(admin, {
        apiKey: key,
        model,
      })(query);
      if (result.state !== "candidate")
        return { product: null, state: result.state };
      const checks = await reviewResearchSources(result.research, {
        signal: AbortSignal.timeout(10000),
      });
      const doc = researchedMenuDocument(
        {
          id: "bartender",
          photoId: "unused",
          imageRevision: 1,
          lineIds: [],
          name: query.name,
          price: null,
          serving: null,
          confirmed: true,
          productId: null,
        },
        result.research,
        checks,
        `bartender-research-${crypto.randomUUID()}`,
      );
      return {
        product: doc ? catalogProduct(doc) : null,
        state: doc ? "verified-source" : "unresolved",
      };
    },
  }),
);
