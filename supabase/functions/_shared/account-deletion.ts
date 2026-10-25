/** No identity comes from the request body. The adapter must verify the initiating bearer token. */
export type AccountDeletionPorts = {
  completed: () => Promise<boolean>;
  authenticate: () => Promise<string | null>;
  begin: (owner: string, lease: string) => Promise<boolean>;
  revoke: (owner: string, lease: string) => Promise<void>;
  files: (owner: string, lease: string) => Promise<string[]>;
  remove: (paths: string[]) => Promise<void>;
  purge: (owner: string, lease: string) => Promise<void>;
  deleteAuth: (owner: string) => Promise<void>;
  finish: (owner: string, lease: string) => Promise<void>;
  release: (owner: string, lease: string) => Promise<void>;
};
export async function deleteAccount(
  ports: AccountDeletionPorts,
  lease: string,
) {
  // A hash of the same bearer can acknowledge an already removed Auth identity after response loss.
  if (await ports.completed()) return { state: "complete" as const };
  const owner = await ports.authenticate();
  if (!owner) throw new Error("UNAUTHENTICATED");
  if (!(await ports.begin(owner, lease))) return { state: "running" as const };
  try {
    await ports.revoke(owner, lease);
    // Bounded work; large accounts continue on the next request without restarting/deleting unrelated owners.
    for (let batch = 0; batch < 10; batch++) {
      const paths = await ports.files(owner, lease);
      if (paths.length) {
        if (
          paths.length > 100 ||
          paths.some(
            (p) =>
              !p.startsWith(`${owner}/`) ||
              p.split("/").some((s) => s === ".." || s === "."),
          )
        )
          throw new Error("INVALID_PHOTO_PATH");
        await ports.remove(paths);
        continue;
      }
      await ports.purge(owner, lease);
      await ports.deleteAuth(owner);
      await ports.finish(owner, lease);
      return { state: "complete" as const };
    }
    return { state: "running" as const };
  } finally {
    await ports.release(owner, lease).catch(() => {});
  }
}
