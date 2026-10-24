import type { MenuDraft } from "./device";
import {
  MAX_MENU_DRAFT_CHARS,
  parseStoredMenu,
  readStoredMenu,
  type MenuRestoreResult,
} from "./restore";
/** Remove only older revisions of a currently committed photo, or exact prior committed photos explicitly removed. */
export function retiredMenuPhotos(
  owner: string,
  directory: string,
  previous: MenuDraft | null,
  next: MenuDraft,
  names: string[],
): string[] {
  const root = `${directory}menu-drafts/${owner}/${next.id}/`,
    keep = new Set(next.photos.map((p) => p.uri)),
    retired = new Set<string>();
  for (const name of names) {
    const match = /^([0-9a-f-]{36})-(\d+)\.jpg$/i.exec(name);
    if (!match) continue;
    const current = next.photos.find((p) => p.id === match[1]);
    if (
      current &&
      Number(match[2]) < current.imageRevision &&
      !keep.has(root + name)
    )
      retired.add(root + name);
  }
  if (previous?.id === next.id)
    for (const old of previous.photos) {
      const canonical = `${root}${old.id}-${old.imageRevision}.jpg`,
        current = next.photos.find((p) => p.id === old.id);
      if (
        old.uri === canonical &&
        !keep.has(old.uri) &&
        (!current || old.imageRevision < current.imageRevision)
      )
        retired.add(old.uri);
    }
  return [...retired];
}
type Ports = {
  directory: string;
  read: (owner: string) => Promise<string | null>;
  write: (owner: string, raw: string) => Promise<void>;
  list: (directory: string) => Promise<string[]>;
  remove: (uri: string) => Promise<void>;
  hydrate?: (draft: MenuDraft) => Promise<MenuDraft>;
};
/** One queue per account, shared across mounted screens. Reads wait for prior writes and cleanup. */
export function createMenuStore(ports: Ports) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(owner: string, work: () => Promise<T>): Promise<T> {
    const pending = (queues.get(owner) ?? Promise.resolve())
      .catch(() => {})
      .then(work);
    queues.set(owner, pending);
    void pending
      .finally(() => {
        if (queues.get(owner) === pending) queues.delete(owner);
      })
      .catch(() => {});
    return pending;
  }
  return {
    save(owner: string, draft: MenuDraft): Promise<void> {
      // Capture before entering the asynchronous queue; later in-memory edits must not mutate this write.
      const raw = JSON.stringify(draft);
      if (raw.length > MAX_MENU_DRAFT_CHARS)
        return Promise.reject(new Error("MENU_DRAFT_TOO_LARGE"));
      return enqueue(owner, async () => {
        const next = parseStoredMenu(raw, owner, ports.directory);
        const previousRaw = await ports.read(owner);
        const previous =
          previousRaw === null
            ? null
            : parseStoredMenu(previousRaw, owner, ports.directory);
        await ports.write(owner, raw);
        // The metadata commit succeeded. Cleanup failure must never claim it failed or delete unknown/future photos.
        try {
          const root = `${ports.directory}menu-drafts/${owner}/${next.id}/`;
          let names: string[] = [];
          try {
            names = await ports.list(root);
          } catch {
            /* Exact previous URIs can still be retired. */
          }
          for (const uri of retiredMenuPhotos(
            owner,
            ports.directory,
            previous,
            next,
            names,
          ))
            await ports.remove(uri).catch(() => {});
        } catch {
          /* Best effort cleanup after durable commit. */
        }
      });
    },
    load(owner: string): Promise<MenuRestoreResult> {
      return enqueue(owner, () =>
        readStoredMenu(
          () => ports.read(owner),
          async (raw) => {
            const draft = parseStoredMenu(raw, owner, ports.directory);
            return ports.hydrate ? ports.hydrate(draft) : draft;
          },
        ),
      );
    },
  };
}
