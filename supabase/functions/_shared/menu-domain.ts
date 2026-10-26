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
// An OCR amount with a damaged currency suffix is only a boundary/correction hint, never a price.
const priceCell =
  /^(?:₩\s*(?:\d{1,3}(?:,\d{3})+|\d+)|\d{1,3}(?:,\d{3})+(?:\s*원)?|\d{3,7}\s*원)$/u;
const damagedPriceCell =
  /^(?:[₩$€¥]\s*)?\d{1,3}(?:,\d{3})+[\p{L}\p{N}%％]{1,4}$/u;
const isDamagedPriceCell = (text: string) =>
  !priceCell.test(text) && damagedPriceCell.test(text);
/** Use shared text baselines only; short amount boxes may be axis-aligned even on a tilted photo. */
function rowSlope(photo: MenuPhoto): number {
  const candidates = photo.lines.flatMap((line) => {
    const text = line.text.trim();
    if (!/\p{L}/u.test(text) || priceCell.test(text) || isDamagedPriceCell(text)) return [];
    const [a, b, c, d] = line.polygon;
    const top = { x: (b.x - a.x) * photo.width, y: (b.y - a.y) * photo.height };
    const bottom = { x: (c.x - d.x) * photo.width, y: (c.y - d.y) * photo.height };
    if (top.x <= 0 || bottom.x <= 0) return [];
    const first = Math.atan2(top.y, top.x), second = Math.atan2(bottom.y, bottom.x);
    const height = (Math.hypot((d.x - a.x) * photo.width, (d.y - a.y) * photo.height)
      + Math.hypot((c.x - b.x) * photo.width, (c.y - b.y) * photo.height)) / 2;
    const width = (Math.hypot(top.x, top.y) + Math.hypot(bottom.x, bottom.y)) / 2;
    if (height <= 0 || width < height * 1.2 || Math.abs(first - second) > Math.PI / 120) return [];
    return [{ angle: (first + second) / 2, long: width >= height * 4,
      centerY: (a.y + b.y + c.y + d.y) / 4 }];
  }).sort((a, b) => a.angle - b.angle);
  if (candidates.length < 3) return 0;
  const middle = Math.floor(candidates.length / 2);
  const median = candidates.length % 2 ? candidates[middle].angle
    : (candidates[middle - 1].angle + candidates[middle].angle) / 2;
  if (Math.abs(median) < Math.PI / 90 || Math.abs(median) > Math.PI / 15) return 0;
  const agreeing = candidates.filter(value => Math.abs(value.angle - median) <= Math.PI / 90);
  const anchors = agreeing.filter(value => value.long);
  if (agreeing.length / candidates.length < 0.7 || anchors.length < 3
    || Math.max(...anchors.map(value => value.centerY)) - Math.min(...anchors.map(value => value.centerY)) < 0.2) return 0;
  return Math.tan(median) * photo.width / photo.height;
}
/** Split complete name→amount columns with a visible gutter, retaining uncertain amounts for review. */
function splitMenuColumns(row: MenuLine[], layout: typeof bounds): MenuLine[][] {
  const groups: MenuLine[][] = [];
  let current: MenuLine[] = [];
  for (const line of row) {
    current.push(line);
    if (
      priceCell.test(line.text.trim()) ||
      isDamagedPriceCell(line.text.trim())
    ) {
      const name = current
        .slice(0, -1)
        .map((l) => l.text)
        .join(" ")
        .replace(
          /\b\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|한\s*잔|글라스|바틀|보틀|glass|bottle/giu,
          "",
        )
        .trim();
      if (!/\p{L}/u.test(name) || /\d{1,3}(?:,\d{3})+/.test(name)) return [row];
      groups.push(current);
      current = [];
    }
  }
  if (current.length || groups.length < 2) return [row];
  for (let i = 1; i < groups.length; i++) {
    const previous = groups[i - 1].at(-1)!;
    const right = Math.max(...previous.polygon.map((p) => p.x));
    if (layout(groups[i][0]).x - right < Math.max(0.02, layout(previous).h))
      return [row];
  }
  return groups;
}
/** Conservative row parser. No cross-row price association and no inferred servings. */
export function parseMenu(photos: MenuPhoto[]): MenuItem[] {
  validatePhotos(photos);
  const output: MenuItem[] = [];
  for (const p of photos) {
    const slope = rowSlope(p);
    // Keep raw polygons/line IDs unchanged. The projection is used only for row comparisons.
    const positions = new Map(p.lines.map(line => {
      const ys = line.polygon.map(point => point.y - slope * point.x);
      return [line, { x: bounds(line).x, y: Math.min(...ys), h: Math.max(...ys) - Math.min(...ys) }] as const;
    }));
    const layout = (line: MenuLine) => positions.get(line)!;
    const sorted = [...p.lines].sort(
      (a, b) => layout(a).y - layout(b).y || layout(a).x - layout(b).x,
    );
    const rows: MenuLine[][] = [];
    for (const line of sorted) {
      const b = layout(line);
      const row = rows.find((r) => {
        const a = layout(r[0]);
        return (
          Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.min(a.h, b.h) * 0.5
        );
      });
      if (row) row.push(line);
      else rows.push([line]);
    }
    for (const unsplit of rows) {
      unsplit.sort((a, b) => layout(a).x - layout(b).x);
      for (const row of splitMenuColumns(unsplit, layout)) {
        const text = row
          .map((l) => l.text)
          .join(" ")
          .trim();
        const damaged = row.filter((line) =>
          isDamagedPriceCell(line.text.trim()),
        );
        // Require explicit currency or comma-grouped amount; years and volumes cannot become prices.
        const prices = [
          ...text.matchAll(
            /(?<![\p{L}\p{N},.])(?:₩\s*(?:\d{1,3}(?:,\d{3})+|\d+)|\d{1,3}(?:,\d{3})+(?:\s*원)?|\d{3,7}\s*원)(?![\d,])/gu,
          ),
        ].filter(
          (m) =>
            !/^\s*(?:%|％|ml\b|cl\b|l\b)/iu.test(
              text.slice((m.index ?? 0) + m[0].length),
            ),
        );
        const labelText = row
          .filter((line) => !damaged.includes(line))
          .map((line) => line.text)
          .join(" ")
          .trim();
        const serving =
          labelText.match(
            /\b\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|한\s*잔|글라스|바틀|보틀|glass|bottle/iu,
          )?.[0] ?? null;
        // OCR can damage one of two prices (15,000% / 150,000), making the
        // valid-price filter see only one. Preserve the ambiguity before filtering.
        const amountHints = [
          ...text.matchAll(/\d{1,3}(?:,\d{3})+[\p{L}\p{N}%％]*/gu),
        ];
        const uncertainAmounts =
          amountHints.length > 1 ||
          amountHints.some((m) => !priceCell.test(m[0]));
        const price =
          prices.length === 1 &&
          !uncertainAmounts &&
          !damaged.length &&
          !/[$€¥]|\b(?:USD|EUR|JPY)\b/i.test(text)
            ? Number(prices[0][0].replace(/[^0-9]/g, ""))
            : null;
        let name = text;
        for (const line of damaged) name = name.replace(line.text, "");
        for (const match of prices) name = name.replace(match[0], "");
        if (serving) name = name.replace(serving, "");
        name = name.replace(/[·|…]+/g, " ").trim();
        if (!name || name.length > 150 || !/\p{L}/u.test(name)) continue;
        // Keep damaged amount rows and exact catalog names as unconfirmed candidates, without fabricating price/product.
        // Other headings/descriptions remain in raw OCR for manual review.
        if (
          !prices.length &&
          !damaged.length &&
          !productCandidates(name).length
        )
          continue;
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
