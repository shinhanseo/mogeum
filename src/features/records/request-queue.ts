/** Account-scoped native requests and their cleanup must not overwrite each other's pending state. */
export function createRecordRequestQueue() {
  const queues = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, action: () => Promise<T>): Promise<T> {
      const next = (queues.get(key) ?? Promise.resolve())
        .catch(() => {})
        .then(action);
      queues.set(key, next);
      void next
        .finally(() => {
          if (queues.get(key) === next) queues.delete(key);
        })
        .catch(() => {});
      return next;
    },
  };
}
export const recordRequestQueue = createRecordRequestQueue();
