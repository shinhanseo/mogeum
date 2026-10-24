import type { ProductMatch } from "../../../supabase/functions/_shared/next-drinks-domain";
import type { DiscoveryResult } from "./contract";

/** Only explicit matching evaluation IDs. One record can support several features without becoming several tastings. */
export function reasonEvidence(
  match: ProductMatch,
  records: DiscoveryResult["evidenceRecords"],
  kind: "positive" | "negative",
) {
  const ids = new Set(
    kind === "positive" ? match.recordIds : match.negativeIds,
  );
  const seen = new Set<string>();
  return records.filter((record) => {
    if (
      !ids.has(record.id) ||
      seen.has(record.id) ||
      (record.revisit !== null &&
        record.revisit !== (kind === "positive" ? "again" : "not_for_me"))
    )
      return false;
    seen.add(record.id);
    return true;
  });
}
