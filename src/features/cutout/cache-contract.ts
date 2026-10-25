import { validDeletionOwner } from "../auth/deletion-local";
export type CutoutCacheEntry = { source: string; file: string };
export function validateCutoutSource(owner: string, source: string) {
  if (
    !validDeletionOwner(owner) ||
    !source.startsWith(`${owner}/records/`) ||
    source.split("/").some((p) => !p || p === "." || p === "..") ||
    source.length > 1024 ||
    /[\\\u0000-\u001f?#]/.test(source)
  )
    throw Error("INVALID_SOURCE");
}
export function decodeCutoutCache(
  raw: string | null,
  owner: string,
): Record<string, CutoutCacheEntry> {
  if (!raw) return {};
  if (raw.length > 1024 * 1024) throw Error("INVALID_CUTOUT_CACHE");
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 2000
  )
    throw Error("INVALID_CUTOUT_CACHE");
  for (const [id, entry] of Object.entries(value)) {
    const e = entry as CutoutCacheEntry;
    if (
      !/^[a-f0-9]{64}$/.test(id) ||
      !e ||
      e.file !== `${id}.png` ||
      typeof e.source !== "string"
    )
      throw Error("INVALID_CUTOUT_CACHE");
    validateCutoutSource(owner, e.source);
  }
  return value;
}
