import { analyzeTaste, type TasteSnapshot } from "./taste-domain.ts";
import {
  normalizeProductName,
  type Product,
  products,
} from "./product-catalog.ts";
export type DrinkHistory = {
  entered_name: string | null;
  category: string | null;
  vintage_status: string | null;
  vintage_year: number | null;
};
export type ProductMatch = {
  factId: string;
  label: string;
  recordIds: string[];
  negativeIds: string[];
};
export type NextDrink = {
  product: Product;
  kind: "close" | "new-category" | "explore";
  similar: ProductMatch[];
  cautions: ProductMatch[];
  unconfirmedFeatures: Product["features"];
  score: number;
};
/** A discovery catalog entry is not a personal recommendation without net positive, cited evidence. */
export function personalizedDrinks(
  rows: NextDrink[],
  excludedIds: ReadonlySet<string> = new Set(),
): NextDrink[] {
  return rows.filter(
    (row) =>
      !excludedIds.has(row.product.id) &&
      row.score > 0 && row.similar.some((f) => f.recordIds.length > 0),
  );
}
/** Edition-aware history check. A missing/ambiguous wine vintage never confirms a catalog edition. */
export function seenProductIds(
  history: DrinkHistory[],
  catalog: readonly Product[] = products,
): Set<string> {
  const found = new Set<string>();
  for (const r of history) {
    if (!r.entered_name) continue;
    const named = normalizeProductName(r.entered_name);
    for (const p of catalog) {
      if (p.category !== r.category) continue;
      const aliases = [p.name, ...p.aliases].map(normalizeProductName);
      if (p.category !== "wine") {
        if (aliases.includes(named)) found.add(p.id);
        continue;
      }
      const year = p.edition.match(/(?:19|20)\d{2}/)?.[0];
      if (year) {
        if (r.vintage_status === "nv" || r.vintage_status === "unknown") {
          continue;
        }
        if (r.vintage_status === "year" && r.vintage_year !== Number(year)) {
          continue;
        }
        const namedWithYear = r.vintage_status === "year"
          ? normalizeProductName(`${r.entered_name} ${r.vintage_year}`)
          : "";
        if (
          aliases.includes(named) ||
          (namedWithYear && aliases.includes(namedWithYear))
        ) {
          found.add(p.id);
        }
      } else if (r.vintage_status === "nv" && aliases.includes(named)) {
        found.add(p.id);
      }
    }
  }
  return found;
}
/** Source facts and explicit evaluations only. Cross-category taste/texture is never inferred from aroma. */
export function discoverDrinks(
  snapshot: TasteSnapshot,
  history: DrinkHistory[],
  category: Product["category"] | null = null,
  savedIds: ReadonlySet<string> = new Set(),
  catalog: readonly Product[] = products,
): NextDrink[] {
  const analysis = analyzeTaste(snapshot),
    seen = seenProductIds(history, catalog),
    byId = new Map(snapshot.records.map((r) => [r.id, r]));
  const ranked = catalog
    .filter((p) =>
      (!category || p.category === category) && !seen.has(p.id) &&
      !savedIds.has(p.id)
    )
    .map((product) => {
      const sameCategory = analysis.facts.some((f) =>
        [...f.positiveIds, ...f.negativeIds, ...f.neutralIds].some(
          (id) => byId.get(id)?.category === product.category,
        )
      );
      const features = product.features.flatMap((feature) => {
        const fact = analysis.facts.find((f) => f.id === feature.id);
        if (!fact) return [];
        const eligible = (id: string) =>
          feature.dimension === "향" ||
          byId.get(id)?.category === product.category;
        const recordIds = fact.positiveIds.filter(eligible),
          negativeIds = fact.negativeIds.filter(eligible);
        return recordIds.length || negativeIds.length
          ? [{ factId: fact.id, label: fact.label, recordIds, negativeIds }]
          : [];
      });
      const similar = features.filter((f) => f.recordIds.length),
        cautions = features.filter((f) => f.negativeIds.length);
      const positive = new Set(
        similar.flatMap((f) =>
          f.recordIds.map((id) => `${f.factId.split(":")[0]}:${id}`)
        ),
      );
      const negative = new Set(
        cautions.flatMap((f) =>
          f.negativeIds.map((id) => `${f.factId.split(":")[0]}:${id}`)
        ),
      );
      const score = positive.size - negative.size;
      return {
        product,
        kind: score > 0 ? (sameCategory ? "close" : "new-category") : "explore",
        similar,
        cautions,
        unconfirmedFeatures: product.features.filter(
          (f) => !features.some((s) => s.factId === f.id),
        ),
        score,
      } as NextDrink;
    })
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    );
  const eligible = personalizedDrinks(ranked);
  if (category) return eligible;
  // Give every supported category a place before adding the second suggestion from each category.
  const kinds: Product["category"][] = [
    "whisky",
    "beer",
    "wine",
    "traditional",
  ];
  const queues = kinds.map((kind) =>
    eligible.filter((r) => r.product.category === kind)
  );
  const output: NextDrink[] = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const row = q.shift();
      if (row) output.push(row);
    }
  }
  return output;
}
