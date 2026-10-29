import {
  analyzeTaste,
  type TasteSnapshot,
} from "../../../supabase/functions/_shared/taste-domain";

/** Evidence follows current observations, including neutral evaluations; it never requires an AI cache. */
export function tasteEvidence(snapshot: TasteSnapshot, factId?: string) {
  const analysis = analyzeTaste(snapshot);
  const facts = factId
    ? analysis.facts.filter((fact) => fact.id === factId)
    : analysis.facts;
  const ids = new Set(
    facts.flatMap((fact) => [
      ...fact.positiveIds,
      ...fact.negativeIds,
      ...fact.neutralIds,
    ]),
  );
  return {
    facts,
    records: snapshot.records.filter((record) => ids.has(record.id)),
  };
}
