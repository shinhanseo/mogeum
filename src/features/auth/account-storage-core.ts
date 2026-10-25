import { deletionReceiptKey, localDataOwner } from "./deletion-local";
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
/** Freeze account writes before cleanup, including work queued by an unmounted screen. */
export function createAccountStorage(storage: Storage) {
  const blocked = new Set<string>(),
    pending = new Map<string, Set<Promise<void>>>();
  return {
    getItem: (key: string) => storage.getItem(key),
    removeItem: (key: string) => storage.removeItem(key),
    setItem(key: string, value: string) {
      const owner = localDataOwner(key);
      if (!owner) return storage.setItem(key, value);
      const work = (async () => {
        const receipt = await storage.getItem(deletionReceiptKey(owner));
        if (blocked.has(owner) || receipt !== null)
          throw Error("ACCOUNT_DELETING");
        await storage.setItem(key, value);
      })();
      const requests = pending.get(owner) ?? new Set<Promise<void>>();
      pending.set(owner, requests);
      requests.add(work);
      void work
        .finally(() => {
          requests.delete(work);
          if (requests.size === 0) pending.delete(owner);
        })
        .catch(() => {});
      return work;
    },
    async freeze(owner: string) {
      blocked.add(owner);
      await Promise.allSettled([...(pending.get(owner) ?? [])]);
    },
  };
}
