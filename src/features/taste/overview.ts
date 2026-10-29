import {
  analyzeTaste,
  type TasteSnapshot,
} from "../../../supabase/functions/_shared/taste-domain";

/** An observation is useful even when it has no positive evaluation; it is never relabeled as preference. */
export function tasteOverview(snapshot: TasteSnapshot) {
  const analysis = analyzeTaste(snapshot);
  const preferred = analysis.facts.filter(
    (fact) => fact.positiveIds.length > 0,
  );
  const observationsOnly = preferred.length === 0;
  const facts = (observationsOnly ? analysis.facts : preferred).slice(0, 3);
  const first = facts[0];
  const originIds = first
    ? observationsOnly
      ? [
          ...new Set([
            ...first.positiveIds,
            ...first.negativeIds,
            ...first.neutralIds,
          ]),
        ]
      : first.positiveIds
    : [];
  return { analysis, facts, observationsOnly, originIds };
}
