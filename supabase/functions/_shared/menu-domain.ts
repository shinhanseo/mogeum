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
export type Product = {
  id: string;
  name: string;
  category: "whisky" | "beer" | "wine" | "traditional";
  aliases: string[];
  features: { id: string; label: string; dimension: string }[];
  source: { url: string; title: string; checkedAt: string };
  description: string;
};
/** Deliberately narrow verified catalog. Aliases propose candidates; users confirm the edition. */
export const products: Product[] = [
  {
    id: "glenlivet-12",
    name: "글렌리벳 12년",
    category: "whisky",
    aliases: [
      "글렌리벳12년",
      "글렌리벳12",
      "theglenlivet12",
      "glenlivet12",
      "glenlivet12yearold",
    ],
    features: [{ id: "향:과일 향", label: "과일 향", dimension: "향" }],
    source: {
      url: "https://www.theglenlivet.com/en-us/product/12-year-old-single-malt-scotch/",
      title: "The Glenlivet · 12 Year Old",
      checkedAt: "2026-10-23",
    },
    description:
      "공식 설명에는 과일 향과 파인애플 맛, 크리미한 마무리가 있어요.",
  },
  {
    id: "guinness-draught",
    name: "기네스 드래프트",
    category: "beer",
    aliases: [
      "기네스드래프트",
      "기네스드래프트생맥주",
      "guinnessdraught",
      "guinnessdraft",
    ],
    features: [
      { id: "질감:크리미한 질감", label: "크리미한 질감", dimension: "질감" },
    ],
    source: {
      url: "https://www.diageobaracademy.com/en-us/home/our-brands/guinness-draught",
      title: "Diageo Bar Academy · Guinness Draught",
      checkedAt: "2026-10-23",
    },
    description:
      "공식 설명에는 커피·맥아 향과 부드럽고 크리미한 질감이 있어요.",
  },
  {
    id: "makers-mark",
    name: "메이커스 마크",
    category: "whisky",
    aliases: ["메이커스마크", "makersmark"],
    features: [
      { id: "향:과일 향", label: "과일 향", dimension: "향" },
      { id: "향:나무 향", label: "나무 향", dimension: "향" },
    ],
    source: {
      url: "https://www.makersmark.com/en-us/bourbons/makers-mark",
      title: "Maker’s Mark · Kentucky Straight Bourbon",
      checkedAt: "2026-10-23",
    },
    description:
      "제조사 설명에는 과일·바닐라·오크 향과 부드러운 질감이 있어요.",
  },
  {
    id: "cloudy-bay-sb-2022",
    name: "클라우디 베이 소비뇽 블랑 2022",
    category: "wine",
    aliases: ["클라우디베이소비뇽블랑2022", "cloudybaysauvignonblanc2022"],
    features: [{ id: "향:과일 향", label: "과일 향", dimension: "향" }],
    source: {
      url: "https://www.cloudybay.com/en-us/our-wines/sauvignon-blanc/sauvignon-blanc-2022/",
      title: "Cloudy Bay · Sauvignon Blanc 2022",
      checkedAt: "2026-10-23",
    },
    description:
      "2022 빈티지 공식 설명에는 감귤·라임·백도·패션프루트 향이 있어요. 다른 빈티지에는 적용하지 않아요.",
  },
];
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function productCandidate(name: string) {
  const n = norm(name);
  return products.find((p) => p.aliases.includes(n)) ?? null;
}
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
      !["apple-vision-v1", "mlkit-korean-16.0.1", "manual"].includes(
        p.engine,
      ) ||
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
  return output.slice(0, 100);
}
export function validateItems(input: unknown, photos: MenuPhoto[]): MenuItem[] {
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
      !item.name.trim() ||
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
        !products.some((p) => p.id === item.productId))
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
      const product = products.find((p) => p.id === item.productId);
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
        score:
          similar.reduce(
            (s, f) => s + f.recordIds.length - f.negativeIds.length,
            0,
          ) + knownPositive.length,
      };
    })
    .sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId));
}
