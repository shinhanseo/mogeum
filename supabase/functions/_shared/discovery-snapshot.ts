import type { TasteSnapshot } from "./taste-domain.ts";

export class DiscoverySnapshotChanged extends Error {
  constructor() {
    super("TASTE_CONTEXT_CHANGED");
  }
}

/** Detect writes during paginated history/recommendation reads, without retrying or mutating records. */
export async function withStableDiscoverySnapshot<T>(
  load: () => Promise<TasteSnapshot>,
  build: (snapshot: TasteSnapshot) => Promise<T>,
): Promise<T> {
  const snapshot = await load();
  // Capture scalars before async work. Never let a later mutation of the input move the comparison baseline.
  const hash = snapshot.hash;
  const total = snapshot.totalRecords;
  const result = await build(snapshot);
  const current = await load();
  if (current.hash !== hash || current.totalRecords !== total)
    throw new DiscoverySnapshotChanged();
  return result;
}
