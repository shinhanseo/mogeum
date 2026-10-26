import { withStableDiscoverySnapshot } from "./discovery-snapshot.ts";
import {
  recommendMenu,
  products,
  PRODUCT_CATALOG_VERSION,
  type MenuItem,
} from "./menu-domain.ts";
import type { TasteSnapshot } from "./taste-domain.ts";
/** Recheck the taste version after building; never return an outdated personal result as current. */
export function stableMenuRecommendation(
  items: MenuItem[],
  load: () => Promise<TasteSnapshot>,
) {
  return withStableDiscoverySnapshot(load, async (snapshot) => {
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
    return {
      recommendations,
      evidenceRecords,
      tasteHash: snapshot.hash,
      recordCount: snapshot.totalRecords,
      method: "evidence-rules-v1",
      limitedCatalog: true,
      catalogVersion: PRODUCT_CATALOG_VERSION,
      catalogSize: products.length,
    };
  });
}
