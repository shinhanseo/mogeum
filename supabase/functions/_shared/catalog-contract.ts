import type { Product } from "./product-catalog.ts";
export type CatalogStatus = "candidate" | "verified" | "held";
export type CatalogDocument = Product & { familyId: string };
const bad = (): never => {
  throw new Error("INVALID_CATALOG_DOCUMENT");
};
const obj = (v: unknown): Record<string, unknown> =>
  !v || typeof v !== "object" || Array.isArray(v)
    ? bad()
    : v as Record<string, unknown>;
const string = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() && v.length <= max ? v : bad();
const key = (v: unknown) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(string(v, 160)) ? v as string : bad();
export function publicSourceUrl(value: unknown): string {
  const raw = string(value, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return bad();
  }
  // Source URLs are links, never permission for arbitrary server fetches.
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    host === "localhost" || !host.includes(".") || host.endsWith(".local") ||
    host.endsWith(".internal") || host.endsWith(".test") ||
    host.endsWith(".localhost") || /^\d/.test(host) || host.includes(":") ||
    host.includes("[")
  ) return bad();
  return raw;
}
/** Untrusted provider/transport boundary. Verification of factual claims happens separately. */
export function parseCatalogDocument(value: unknown): CatalogDocument {
  const v = obj(value), source = obj(v.source);
  if (
    !["whisky", "beer", "wine", "traditional"].includes(v.category as string) ||
    !["producer", "expert-tasting"].includes(source.kind as string)
  ) return bad();
  const aliases = (input: unknown) => {
    if (!Array.isArray(input) || input.length > 60) return bad();
    const rows = input.map((x) => string(x, 300));
    if (new Set(rows).size !== rows.length) return bad();
    return rows;
  };
  if (!Array.isArray(v.features) || v.features.length > 80) return bad();
  const features = v.features.map((raw) => {
    const f = obj(raw);
    return {
      id: string(f.id, 160),
      label: string(f.label, 200),
      dimension: string(f.dimension, 80),
      evidence: string(f.evidence, 2000),
    };
  });
  if (new Set(features.map((f) => f.id)).size !== features.length) return bad();
  const checkedAt = string(source.checkedAt, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) ||
    new Date(checkedAt).toISOString().slice(0, 10) !== checkedAt
  ) return bad();
  return {
    id: key(v.id),
    familyId: key(v.familyId),
    name: string(v.name, 300),
    category: v.category as Product["category"],
    edition: string(v.edition, 300),
    aliases: aliases(v.aliases),
    baseAliases: aliases(v.baseAliases),
    features,
    source: {
      url: publicSourceUrl(source.url),
      title: string(source.title, 500),
      checkedAt,
      kind: source.kind as Product["source"]["kind"],
    },
    description: string(v.description, 4000),
  };
}

/** Bounded transport contracts; these limits never imply factual verification. */
export const SHARED_CATALOG_VERSION = "shared-catalog-v1";
export const MAX_CATALOG_PRODUCTS = 1000;
export const MAX_WISHLIST_ROWS = 10000;
export function isCatalogProductId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 160 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
/** Only call on rows read through authenticated verified-only RLS. */
export function verifiedCatalogRow(value: unknown): CatalogDocument {
  const row = obj(value), document = parseCatalogDocument(row.document);
  if (
    row.status !== "verified" || row.id !== document.id ||
    row.family_id !== document.familyId || row.category !== document.category ||
    !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 ||
    !document.features.length
  ) return bad();
  return document;
}
export function catalogProduct(document: CatalogDocument): Product {
  const { familyId: _familyId, ...product } = document;
  return product;
}
