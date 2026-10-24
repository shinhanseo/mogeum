export type EvidenceRefresh =
  | { status: "fresh"; photos: Record<string, string> }
  | { status: "stale" }
  | { status: "cancelled" };
type Ports = {
  active: () => boolean;
  hash: () => Promise<string>;
  photos: () => Promise<Record<string, string>>;
};
/** Only publish links for the same recommendation, current owner and verified input hash. */
export async function refreshMenuEvidence(
  expectedHash: string,
  ports: Ports,
): Promise<EvidenceRefresh> {
  if (!ports.active()) return { status: "cancelled" };
  const hash = await ports.hash();
  if (!ports.active()) return { status: "cancelled" };
  if (typeof hash !== "string" || !hash)
    throw new Error("INVALID_TASTE_CONTEXT");
  if (hash !== expectedHash) return { status: "stale" };
  // A private image failure must not invent URLs or discard valid textual evidence.
  const photos = await ports.photos().catch(() => ({}));
  if (!ports.active()) return { status: "cancelled" };
  const verifiedHash = await ports.hash();
  if (!ports.active()) return { status: "cancelled" };
  if (typeof verifiedHash !== "string" || !verifiedHash)
    throw new Error("INVALID_TASTE_CONTEXT");
  if (verifiedHash !== expectedHash) return { status: "stale" };
  return { status: "fresh", photos };
}
