const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
export const validDeletionOwner = (owner: string) =>
  new RegExp(`^${uuid}$`, "i").test(owner);
export const deletionReceiptKey = (owner: string) =>
  `mogeum-delete-v1-${owner}`;
export function localDataOwner(key: string): string | null {
  return (
    key.match(
      new RegExp(
        `^(?:mogeum-pending-v1-|mogeum:(?:menu|wishlist):v1:)(${uuid})$`,
        "i",
      ),
    )?.[1] ??
    key.match(
      new RegExp(`^mogeum-(?:tasting|attachment)-v1-(${uuid})-${uuid}$`, "i"),
    )?.[1] ??
    null
  );
}
/** Exact account-owned keys only; auth sessions and other accounts remain untouched. */
export function deletedAccountKeys(owner: string, keys: readonly string[]) {
  if (!validDeletionOwner(owner)) throw Error("INVALID_OWNER");
  return keys.filter((key) => localDataOwner(key) === owner);
}
