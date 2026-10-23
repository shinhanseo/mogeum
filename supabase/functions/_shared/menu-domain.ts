import { analyzeTaste, type TasteSnapshot } from "./taste-domain.ts";
export const MENU_VERSION = 1;
export type Point = { x: number; y: number };
export type MenuLine = {
  id: string;
  text: string;
  confidence: number | null;
  polygon: Point[];
};
export type MenuPhoto = {
  id: string;
  imageRevision: number;
  width: number;
  height: number;
  engine: string;
  lines: MenuLine[];
};
export type MenuItem = {
  id: string;
  photoId: string;
  imageRevision: number;
  lineIds: string[];
  name: string;
  price: number | null;
  serving: string | null;
  productId: string | null;
  confirmed: boolean;
};
export {
  products,
  productCandidate,
  productCandidates,
  PRODUCT_CATALOG_VERSION,
  type Product,
} from "./product-catalog.ts";
import {
  productCandidates,
  normalizeProductName as norm,
} from "./product-catalog.ts";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validatePhotos(input: unknown): MenuPhoto[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5)
    throw new Error("INVALID_PHOTOS");
  const ids = new Set<string>();
  let chars = 0;
  for (const p of input) {
    if (
      !p ||
      !uuid.test(p.id) ||
      ids.has(p.id) ||
      !Number.isInteger(p.imageRevision) ||
      p.imageRevision < 1 ||
      p.imageRevision > 10000 ||
      !Number.isInteger(p.width) ||
      !Number.isInteger(p.height) ||
      p.width < 1 ||
      p.height < 1 ||
      p.width > 2400 ||
      p.height > 2400 ||
      ![
        "apple-vision-v1",
        "apple-vision-v2",
        "mlkit-korean-16.0.1",
        "manual",
      ].includes(p.engine) ||
      !Array.isArray(p.lines) ||
      p.lines.length > 500
    )
      throw new Error("INVALID_PHOTO");
    ids.add(p.id);
    const lineIds = new Set<string>();
    for (const line of p.lines) {
      if (
        !line ||
        typeof line.id !== "string" ||
        line.id !== `${p.id}:${p.imageRevision}:${lineIds.size}` ||
        lineIds.has(line.id) ||
        typeof line.text !== "string" ||
        !line.text.trim() ||
        line.text.length > 500 ||
        (line.confidence !== null &&
          (!Number.isFinite(line.confidence) ||
            line.confidence < 0 ||
            line.confidence > 1)) ||
        !Array.isArray(line.polygon) ||
        line.polygon.length !== 4 ||
        line.polygon.some(
          (v: Point) =>
            !v ||
            !Number.isFinite(v.x) ||
            !Number.isFinite(v.y) ||
            v.x < 0 ||
            v.x > 1 ||
            v.y < 0 ||
            v.y > 1,
        )
      )
        throw new Error("INVALID_LINE");
      lineIds.add(line.id);
      chars += line.text.length;
    }
  }
  if (chars > 100000) throw new Error("TOO_LARGE");
  return input as MenuPhoto[];
}
const bounds = (l: MenuLine) => ({
  x: Math.min(...l.polygon.map((p) => p.x)),
  y: Math.min(...l.polygon.map((p) => p.y)),
  h:
    Math.max(...l.polygon.map((p) => p.y)) -
    Math.min(...l.polygon.map((p) => p.y)),
});
/** Conservative row parser. No cross-row price association and no inferred servings. */
export function parseMenu(photos: MenuPhoto[]): MenuItem[] {
  validatePhotos(photos);
  const output: MenuItem[] = [];
  for (const p of photos) {
    const sorted = [...p.lines].sort(
      (a, b) => bounds(a).y - bounds(b).y || bounds(a).x - bounds(b).x,
    );
    const rows: MenuLine[][] = [];
    for (const line of sorted) {
      const b = bounds(line);
      const row = rows.find((r) => {
        const a = bounds(r[0]);
        return (
          Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.min(a.h, b.h) * 0.5
        );
      });
      if (row) row.push(line);
      else rows.push([line]);
    }
    for (const row of rows) {
      row.sort((a, b) => bounds(a).x - bounds(b).x);
      const text = row
        .map((l) => l.text)
        .join(" ")
        .trim();
      // Require explicit currency or comma-grouped amount; years and volumes cannot become prices.
      const prices = [
        ...text.matchAll(
          /(?:₩\s*\d[\d,]*|\d{1,3}(?:,\d{3})+(?:\s*원)?|\d{3,7}\s*원)/g,
        ),
      ].filter(
        (m) =>
          !/^\s*(?:ml|cl|l)\b/iu.test(text.slice((m.index ?? 0) + m[0].length)),
      );
      const serving =
        text.match(
          /\b\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|한\s*잔|글라스|바틀|보틀|glass|bottle/iu,
        )?.[0] ?? null;
      const price =
        prices.length === 1 && !/[$€¥]|\b(?:USD|EUR|JPY)\b/i.test(text)
          ? Number(prices[0][0].replace(/[^0-9]/g, ""))
          : null;
      let name = text;
      for (const match of prices) name = name.replace(match[0], "");
      if (serving) name = name.replace(serving, "");
      name = name.replace(/[·|…]+/g, " ").trim();
      if (!name || name.length > 150 || !/\p{L}/u.test(name)) continue;
      // Headings/unpriced descriptions are not safely identifiable as menu items. Raw lines remain available.
      if (!prices.length) continue;
      output.push({
        id: `${p.id}:${p.imageRevision}:item:${row[0].id.split(":").at(-1)}`,
        photoId: p.id,
        imageRevision: p.imageRevision,
        lineIds: row.map((l) => l.id),
        name,
        price:
          price !== null && Number.isSafeInteger(price) && price > 0
            ? price
            : null,
        serving,
        productId: null,
        confirmed: false,
      });
    }
  }
  if (output.length > 100) throw new Error("MENU_ITEM_LIMIT");
  return output;
}
/** Stored replay is opaque transport, never a product confirmation or recommendation permission. */
export function validateItems(
  input: unknown,
  photos: MenuPhoto[],
  productMode: "catalog" | "stored" = "catalog",
  incompleteDraft = false,
): MenuItem[] {
  if (!Array.isArray(input) || input.length > 100)
    throw new Error("INVALID_ITEMS");
  const seen = new Set<string>();
  for (const item of input) {
    const p = photos.find(
      (p) => p.id === item?.photoId && p.imageRevision === item.imageRevision,
    );
    if (
      !p ||
      typeof item.id !== "string" ||
      item.id.length > 160 ||
      seen.has(item.id) ||
      !item.id.startsWith(`${p.id}:${p.imageRevision}:`) ||
      typeof item.name !== "string" ||
      (!item.name.trim() && (!incompleteDraft || item.confirmed)) ||
      item.name.length > 150 ||
      (item.price !== null &&
        (!Number.isSafeInteger(item.price) ||
          item.price < 1 ||
          item.price > 100000000)) ||
      (item.serving !== null &&
        (typeof item.serving !== "string" || item.serving.length > 60)) ||
      typeof item.confirmed !== "boolean" ||
      !Array.isArray(item.lineIds) ||
      item.lineIds.length > 20 ||
      item.lineIds.some((id: unknown) => !p.lines.some((l) => l.id === id)) ||
      (item.productId !== null &&
        (typeof item.productId !== "string" ||
          !item.productId.trim() ||
          item.productId.length > 160 ||
          (productMode === "catalog" &&
            !productCandidates(item.name).some(
              (p) => p.id === item.productId,
            ))))
    )
      throw new Error("INVALID_ITEM");
    seen.add(item.id);
  }
  return input as MenuItem[];
}
export type MenuRecommendation = {
  itemId: string;
  productId: string | null;
  status: "similar" | "known" | "unmatched" | "unverified";
  similar: {
    factId: string;
    label: string;
    recordIds: string[];
    negativeIds: string[];
  }[];
  other: { label: string; dimension: string }[];
  knownRecordIds: string[];
  score: number;
};
export function recommendMenu(
  items: MenuItem[],
  snapshot: TasteSnapshot,
): MenuRecommendation[] {
  const analysis = analyzeTaste(snapshot);
  return items
    .filter((i) => i.confirmed)
    .map((item) => {
      const product = productCandidates(item.name).find(
        (p) => p.id === item.productId,
      );
      const known = snapshot.records.filter(
        (r) => r.name && norm(r.name) === norm(item.name),
      );
      const similar = (product?.features ?? []).flatMap((f) => {
        const fact = analysis.facts.find(
          (t) => t.id === f.id && t.positiveIds.length,
        );
        return fact
          ? [
              {
                factId: fact.id,
                label: fact.label,
                recordIds: fact.positiveIds,
                negativeIds: fact.negativeIds,
              },
            ]
          : [];
      });
      const other = (product?.features ?? [])
        .filter((f) => !similar.some((s) => s.factId === f.id))
        .map((f) => ({ label: f.label, dimension: f.dimension }));
      const knownPositive = known.filter(
        (r) =>
          r.revisit === "again" ||
          (r.revisit === null && r.rating !== null && r.rating >= 4),
      );
      return {
        itemId: item.id,
        productId: product?.id ?? null,
        status: !product
          ? ("unverified" as const)
          : similar.length
            ? ("similar" as const)
            : knownPositive.length
              ? ("known" as const)
              : ("unmatched" as const),
        similar,
        other,
        knownRecordIds: knownPositive.map((r) => r.id),
        score: (() => {
          const support = new Set<string>();
          const opposition = new Set<string>();
          for (const f of similar) {
            const dimension = f.factId.split(":")[0];
            for (const id of f.recordIds) support.add(`${dimension}:${id}`);
            for (const id of f.negativeIds)
              opposition.add(`${dimension}:${id}`);
          }
          return support.size - opposition.size + knownPositive.length;
        })(),
      };
    })
    .sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId));
}
