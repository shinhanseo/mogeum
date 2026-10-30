import type { MenuRecommendation } from "./menu-domain.ts";
export const MENU_SELECTION_VERSION = "menu-selection-v1";
export type MenuSelection = {version: typeof MENU_SELECTION_VERSION; itemIds: string[]};
export type MenuSelectionState = "generated" | "cached" | "insufficient" | "running" | "backoff" | "daily-limit";
/** Rank only supported choices; unknown products cannot become personal recommendations. */
export function menuSelectionCandidates(rows: readonly MenuRecommendation[]) {
  return rows.filter(row => row.productId && row.score > 0 && (row.status === "similar" || row.status === "known")).slice(0, 80);
}
export function validateMenuSelection(value: unknown, candidates: readonly MenuRecommendation[]): MenuSelection {
  const v = value as Partial<MenuSelection> | null;
  const allowed = new Set(candidates.map(row => row.itemId));
  if (!v || v.version !== MENU_SELECTION_VERSION || !Array.isArray(v.itemIds) || v.itemIds.length < 1 || v.itemIds.length > 10 ||
      new Set(v.itemIds).size !== v.itemIds.length || v.itemIds.some(id => typeof id !== "string" || !allowed.has(id))) throw Error("INVALID_MENU_SELECTION");
  return {version: MENU_SELECTION_VERSION, itemIds: [...v.itemIds]};
}
/** Keep every menu row, original facts/prices and unsupported states; only order is model-selected. */
export function orderSelectedMenu(rows: readonly MenuRecommendation[], selection: MenuSelection) {
  const checked = validateMenuSelection(selection, menuSelectionCandidates(rows));
  const byId = new Map(rows.map(row => [row.itemId, row]));
  const selected = new Set(checked.itemIds);
  return [...checked.itemIds.map(id => byId.get(id)!), ...rows.filter(row => !selected.has(row.itemId))];
}
export type MenuSelectionPorts = {
  begin: (lease: string) => Promise<{state: string; result?: unknown}>;
  finish: (lease: string, result: MenuSelection | null) => Promise<boolean>;
  select: (candidates: readonly MenuRecommendation[], signal: AbortSignal) => Promise<unknown>;
};
export async function runMenuSelection(rows: readonly MenuRecommendation[], ports: MenuSelectionPorts) {
  const candidates = menuSelectionCandidates(rows);
  if (!candidates.length) return {state: "insufficient" as const, recommendations: [...rows], modelUsed: false};
  const lease = crypto.randomUUID(), job = await ports.begin(lease);
  if (job.state === "cached") return {state: "cached" as const, recommendations: orderSelectedMenu(rows, validateMenuSelection(job.result, candidates)), modelUsed: true};
  if (["running", "backoff", "daily-limit"].includes(job.state)) return {state: job.state as "running" | "backoff" | "daily-limit", recommendations: [...rows], modelUsed: false};
  if (job.state !== "acquired") throw Error("INVALID_MENU_RESERVATION");
  try {
    const selected = validateMenuSelection(await ports.select(candidates, AbortSignal.timeout(18000)), candidates);
    if (!await ports.finish(lease, selected)) throw Error("MENU_SELECTION_LEASE_EXPIRED");
    return {state: "generated" as const, recommendations: orderSelectedMenu(rows, selected), modelUsed: true};
  } catch (error) {
    try {await ports.finish(lease, null);} catch {/* Expiring lease bounds failed completion; don't log provider payloads. */}
    throw error;
  }
}
