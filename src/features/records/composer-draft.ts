const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type ComposerPhoto = { id: string; width: number; height: number };
export type RecordComposerDraft = {
  version: 1;
  ownerId: string;
  context: string;
  id: string;
  revision: number;
  step: "start" | "info" | "rating";
  name: string;
  category: "whisky" | "wine" | "beer" | "traditional" | "other" | null;
  feeling: "again" | "okay" | "not_for_me" | null;
  stars: number;
  consumedAt: string;
  vintageMode: "year" | "NV" | "unknown";
  vintageYear: string;
  vintage: string;
  entryId: string | null;
  separateName: string | null;
  photo: ComposerPhoto | null;
};
export function composerContext(entryId?: string, productId?: string) {
  if (entryId) {
    if (!UUID.test(entryId)) throw Error("INVALID_COMPOSER_CONTEXT");
    return `entry:${entryId}`;
  }
  if (productId) {
    if (!/^[a-z0-9_-]{1,120}$/i.test(productId))
      throw Error("INVALID_COMPOSER_CONTEXT");
    return `product:${productId}`;
  }
  return "new";
}
export function composerStorageKey(owner: string, context: string) {
  if (
    !UUID.test(owner) ||
    typeof context !== "string" ||
    !(
      context === "new" ||
      (context.startsWith("entry:") && UUID.test(context.slice(6))) ||
      /^product:[a-z0-9_-]{1,120}$/i.test(context)
    )
  )
    throw Error("INVALID_COMPOSER_CONTEXT");
  return `mogeum:record-composer:v1:${owner}:${context}`;
}
export function composerPhotoUri(
  directory: string | null,
  owner: string,
  photoId: string,
) {
  if (!directory || !UUID.test(owner) || !UUID.test(photoId))
    throw Error("INVALID_COMPOSER_PHOTO");
  return `${directory}record-composer-drafts/${owner}/${photoId}.jpg`;
}
export function parseComposerDraft(
  raw: string,
  owner: string,
  context: string,
): RecordComposerDraft {
  composerStorageKey(owner, context);
  if (!raw || raw.length > 20000) throw Error("INVALID_COMPOSER_DRAFT");
  const d = JSON.parse(raw) as RecordComposerDraft;
  if (
    !d ||
    d.version !== 1 ||
    d.ownerId !== owner ||
    d.context !== context ||
    !UUID.test(d.id) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1 ||
    !["start", "info", "rating"].includes(d.step) ||
    typeof d.name !== "string" ||
    d.name.length > 200 ||
    ![null, "whisky", "wine", "beer", "traditional", "other"].includes(
      d.category,
    ) ||
    ![null, "again", "okay", "not_for_me"].includes(d.feeling) ||
    !Number.isInteger(d.stars) ||
    d.stars < 0 ||
    d.stars > 5 ||
    typeof d.consumedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(d.consumedAt) ||
    !Number.isFinite(Date.parse(d.consumedAt)) ||
    !["year", "NV", "unknown"].includes(d.vintageMode) ||
    typeof d.vintageYear !== "string" ||
    !/^\d{0,4}$/.test(d.vintageYear) ||
    typeof d.vintage !== "string" ||
    d.vintage.length > 10 ||
    (d.entryId !== null && !UUID.test(d.entryId)) ||
    (d.separateName !== null &&
      (typeof d.separateName !== "string" || d.separateName.length > 200))
  )
    throw Error("INVALID_COMPOSER_DRAFT");
  if (
    d.photo !== null &&
    (!d.photo ||
      !UUID.test(d.photo.id) ||
      !Number.isInteger(d.photo.width) ||
      !Number.isInteger(d.photo.height) ||
      d.photo.width < 1 ||
      d.photo.height < 1 ||
      d.photo.width > 20000 ||
      d.photo.height > 20000)
  )
    throw Error("INVALID_COMPOSER_PHOTO");
  return d;
}
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, raw: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};
/** The queue and revision check preserve newer keystrokes and prevent old cleanup from deleting them. */
export function createComposerDraftStorage(storage: Storage) {
  const queues = new Map<string, Promise<unknown>>(),
    closed = new Set<string>();
  function enqueue<T>(key: string, action: () => Promise<T>): Promise<T> {
    const work = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(action);
    queues.set(key, work);
    void work
      .finally(() => {
        if (queues.get(key) === work) queues.delete(key);
      })
      .catch(() => {});
    return work;
  }
  return {
    restore(
      owner: string,
      context: string,
    ): Promise<RecordComposerDraft | null> {
      const key = composerStorageKey(owner, context);
      return enqueue(key, async () => {
        const raw = await storage.getItem(key);
        return raw === null ? null : parseComposerDraft(raw, owner, context);
      });
    },
    persist(value: RecordComposerDraft): Promise<void> {
      const raw = JSON.stringify(value),
        d = parseComposerDraft(raw, value.ownerId, value.context),
        key = composerStorageKey(d.ownerId, d.context);
      return enqueue(key, async () => {
        if (closed.has(`${key}|${d.id}`)) throw Error("COMPOSER_DRAFT_CLOSED");
        const currentRaw = await storage.getItem(key);
        if (currentRaw !== null) {
          const current = parseComposerDraft(currentRaw, d.ownerId, d.context);
          if (
            current.id !== d.id ||
            current.revision > d.revision ||
            (current.revision === d.revision && currentRaw !== raw)
          )
            throw Error("COMPOSER_DRAFT_CONFLICT");
        }
        await storage.setItem(key, raw);
      });
    },
    finish(
      value: RecordComposerDraft,
      beforeRemove?: () => Promise<void>,
    ): Promise<boolean> {
      const key = composerStorageKey(value.ownerId, value.context),
        expected = JSON.stringify(value);
      return enqueue(key, async () => {
        const current = await storage.getItem(key);
        if (current !== null && current !== expected) return false;
        await beforeRemove?.();
        await storage.removeItem(key);
        closed.add(`${key}|${value.id}`);
        return true;
      });
    },
  };
}
