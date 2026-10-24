/** Serialize uncommitted photo preparation across screen mounts for the same account. */
export function createPhotoPreparationQueue() {
  const queues = new Map<string, Promise<unknown>>();
  return {
    run<T>(
      owner: string,
      ports: {
        count: number;
        active: () => boolean;
        prepare: (index: number) => Promise<T>;
        commit: (photos: T[]) => void;
        discard: (photo: T) => Promise<void>;
      },
    ): Promise<T[] | null> {
      const work = (queues.get(owner) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          const prepared: T[] = [];
          let committed = false;
          try {
            for (let index = 0; index < ports.count; index++) {
              if (!ports.active()) return null;
              const photo = await ports.prepare(index);
              prepared.push(photo);
              if (!ports.active()) return null;
            }
            if (!ports.active()) return null;
            ports.commit(prepared);
            committed = true;
            return prepared;
          } finally {
            if (!committed)
              for (const photo of prepared)
                await ports.discard(photo).catch(() => {});
          }
        });
      queues.set(owner, work);
      void work
        .finally(() => {
          if (queues.get(owner) === work) queues.delete(owner);
        })
        .catch(() => {});
      return work;
    },
  };
}
