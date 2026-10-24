import type { TastingDraft } from "./draft";
import { parseTastingDraft } from "./validate-draft";
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, raw: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};
const key = (owner: string, record: string) =>
  `mogeum-tasting-v1-${owner}-${record}`;
/** Reads, writes and cleanup share a queue so navigation never restores an older keystroke. */
export function createTastingDraftStorage(storage: Storage) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(
    storageKey: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const pending = (queues.get(storageKey) ?? Promise.resolve())
      .catch(() => {})
      .then(action);
    queues.set(storageKey, pending);
    void pending
      .finally(() => {
        if (queues.get(storageKey) === pending) queues.delete(storageKey);
      })
      .catch(() => {});
    return pending;
  }
  return {
    persist(draft: TastingDraft): Promise<void> {
      const raw = JSON.stringify(draft);
      if (raw.length > 100000)
        return Promise.reject(new Error("Draft is too large"));
      return enqueue(key(draft.ownerId, draft.recordId), async () => {
        await storage.setItem(key(draft.ownerId, draft.recordId), raw);
      });
    },
    restore(owner: string, record: string): Promise<TastingDraft | null> {
      return enqueue(key(owner, record), async () => {
        const raw = await storage.getItem(key(owner, record));
        return raw === null ? null : parseTastingDraft(raw, owner, record);
      });
    },
    clear(
      owner: string,
      record: string,
      expected?: TastingDraft,
    ): Promise<boolean> {
      const raw = expected === undefined ? undefined : JSON.stringify(expected);
      return enqueue(key(owner, record), async () => {
        if (raw !== undefined) {
          const current = await storage.getItem(key(owner, record));
          if (current === null) return true;
          if (current !== raw) return false;
        }
        await storage.removeItem(key(owner, record));
        return true;
      });
    },
  };
}
