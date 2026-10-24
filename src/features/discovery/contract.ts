import {
  products,
  PRODUCT_CATALOG_VERSION,
  type Product,
} from "../../../supabase/functions/_shared/product-catalog";
import type {
  NextDrink,
  ProductMatch,
} from "../../../supabase/functions/_shared/next-drinks-domain";

type EvidenceRecord = {
  id: string;
  name: string | null;
  category: Product["category"];
  date: string;
  revision: number;
  revisit: "again" | "okay" | "not_for_me" | null;
  noteText: string | null;
};
export type DiscoveryResult = {
  recommendations: NextDrink[];
  wishlist: { product_id: string; saved: boolean; revision: number }[];
  evidenceRecords: EvidenceRecord[];
  tasteHash: string;
  recordCount: number;
  sensoryRecordCount: number;
  omittedSensoryRecords: number;
  method: "evidence-rules-v1";
  modelUsed: false;
  catalogVersion: typeof PRODUCT_CATALOG_VERSION;
  catalogSize: number;
  limitedCatalog: true;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "undefined";
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
const fail = (): never => {
  throw new Error("INVALID_DISCOVERY_RESPONSE");
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function list(v: unknown, limit: number): unknown[] {
  if (!Array.isArray(v) || v.length > limit) return fail();
  return v;
}
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || !v.length || v.length > max) return fail();
  return v;
}
function count(v: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(v) || (v as number) < minimum) return fail();
  return v as number;
}
function unique<T>(rows: T[], key: (r: T) => string): T[] {
  if (new Set(rows.map(key)).size !== rows.length) return fail();
  return rows;
}
function nullableText(v: unknown, max: number): string | null {
  return v === null
    ? null
    : typeof v === "string" && v.length <= max
      ? v
      : fail();
}
const categories = new Set(products.map((p) => p.category));
/** Validate the transport boundary; sensory truth remains the authenticated server's responsibility. */
export function parseDiscoveryResult(value: unknown): DiscoveryResult {
  const v = object(value);
  if (
    v.catalogVersion !== PRODUCT_CATALOG_VERSION ||
    v.catalogSize !== products.length ||
    v.method !== "evidence-rules-v1" ||
    v.modelUsed !== false ||
    v.limitedCatalog !== true
  )
    return fail();
  const recordCount = count(v.recordCount),
    sensoryRecordCount = count(v.sensoryRecordCount),
    omittedSensoryRecords = count(v.omittedSensoryRecords);
  if (
    sensoryRecordCount > Math.min(recordCount, 200) ||
    omittedSensoryRecords > recordCount
  )
    return fail();
  const evidenceRecords = unique(
    list(v.evidenceRecords, 200).map((row) => {
      const r = object(row);
      if (
        !categories.has(r.category as Product["category"]) ||
        ![null, "again", "okay", "not_for_me"].includes(r.revisit as null) ||
        typeof r.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
          r.date,
        ) ||
        !Number.isFinite(Date.parse(r.date))
      )
        return fail();
      return {
        id: text(r.id, 100),
        name: nullableText(r.name, 500),
        category: r.category as Product["category"],
        date: r.date,
        revision: count(r.revision, 1),
        revisit: r.revisit as EvidenceRecord["revisit"],
        noteText: nullableText(r.noteText, 20000),
      };
    }),
    (r) => r.id,
  );
  if (evidenceRecords.length > sensoryRecordCount) return fail();
  const records = new Map(evidenceRecords.map((r) => [r.id, r]));
  const recommendations = unique(
    list(v.recommendations, products.length).map((row) => {
      const r = object(row),
        supplied = object(r.product),
        product = products.find((p) => p.id === supplied.id);
      // Never expose a response-supplied URL or invented product facts to the UI.
      if (!product || canonical(supplied) !== canonical(product)) return fail();
      function matches(input: unknown, positive: boolean): ProductMatch[] {
        return unique(
          list(input, product!.features.length).map((raw) => {
            const f = object(raw),
              feature = product!.features.find((x) => x.id === f.factId);
            if (!feature || f.label !== feature.label) return fail();
            const ids = (input: unknown, negative: boolean) =>
              unique(
                list(input, 200).map((raw) => {
                  const id = text(raw, 100),
                    record = records.get(id);
                  if (
                    !record ||
                    (feature.dimension !== "향" &&
                      record.category !== product!.category) ||
                    (negative
                      ? record.revisit === "again"
                      : record.revisit === "not_for_me")
                  )
                    return fail();
                  return id;
                }),
                (id) => id,
              );
            const recordIds = ids(f.recordIds, false),
              negativeIds = ids(f.negativeIds, true);
            if (
              !(positive ? recordIds.length : negativeIds.length) ||
              recordIds.some((id) => negativeIds.includes(id))
            )
              return fail();
            return {
              factId: feature.id,
              label: feature.label,
              recordIds,
              negativeIds,
            };
          }),
          (f) => f.factId,
        );
      }
      const similar = matches(r.similar, true),
        cautions = matches(r.cautions, false);
      const observed = new Map(
        [...similar, ...cautions].map((f) => [f.factId, f]),
      );
      for (const f of [...similar, ...cautions])
        if (canonical(f) !== canonical(observed.get(f.factId))) return fail();
      const expectedUnconfirmed = product.features.filter(
        (f) => !observed.has(f.id),
      );
      if (canonical(r.unconfirmedFeatures) !== canonical(expectedUnconfirmed))
        return fail();
      const support = new Set(
        similar.flatMap((f) =>
          f.recordIds.map((id) => `${f.factId.split(":")[0]}:${id}`),
        ),
      ).size;
      const opposition = new Set(
        cautions.flatMap((f) =>
          f.negativeIds.map((id) => `${f.factId.split(":")[0]}:${id}`),
        ),
      ).size;
      if (
        r.score !== support - opposition ||
        !["close", "new-category", "explore"].includes(r.kind as string) ||
        r.score > 0 !== (r.kind !== "explore")
      )
        return fail();
      return {
        product: clone(product),
        similar,
        cautions,
        unconfirmedFeatures: clone(expectedUnconfirmed),
        score: r.score,
        kind: r.kind,
      } as NextDrink;
    }),
    (r) => r.product.id,
  );
  const wishlist = unique(
    list(v.wishlist, products.length).map((raw) => {
      const r = object(raw);
      if (
        !products.some((p) => p.id === r.product_id) ||
        typeof r.saved !== "boolean"
      )
        return fail();
      return {
        product_id: r.product_id as string,
        saved: r.saved,
        revision: count(r.revision, 1),
      };
    }),
    (r) => r.product_id,
  );
  return {
    recommendations,
    wishlist,
    evidenceRecords,
    recordCount,
    sensoryRecordCount,
    omittedSensoryRecords,
    tasteHash: text(v.tasteHash, 200),
    method: "evidence-rules-v1",
    modelUsed: false,
    catalogVersion: PRODUCT_CATALOG_VERSION,
    catalogSize: products.length,
    limitedCatalog: true,
  };
}
