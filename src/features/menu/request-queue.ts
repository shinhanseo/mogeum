/** A reopened menu must wait for an earlier server save and its durable receipt. */
export function createMenuRequestQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return {
    run<T>(owner: string, work: () => Promise<T>): Promise<T> {
      const next = (pending.get(owner) ?? Promise.resolve())
        .catch(() => {})
        .then(work);
      pending.set(owner, next);
      void next
        .finally(() => {
          if (pending.get(owner) === next) pending.delete(owner);
        })
        .catch(() => {});
      return next;
    },
  };
}
export const menuRequestQueue = createMenuRequestQueue();
