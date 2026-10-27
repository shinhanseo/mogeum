import { catalogProduct, type CatalogDocument, SHARED_CATALOG_VERSION } from "./catalog-contract.ts";
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
  catalog?: CatalogDocument[],
) {
  return withStableDiscoverySnapshot(load, async (snapshot) => {
    const recommendations = recommendMenu(items, snapshot, catalog?.map(catalogProduct));
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
      ...(catalog ? {catalog} : {}),
      catalogVersion: catalog ? SHARED_CATALOG_VERSION : PRODUCT_CATALOG_VERSION,
      catalogSize: catalog?.length ?? products.length,
    };
  });
}
