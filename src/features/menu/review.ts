import type {
  MenuItem,
  MenuPhoto,
} from "../../../supabase/functions/_shared/menu-domain";
/** A review may only survive if both its item identity and exact OCR source still match. */
export function mergeMenuReview(
  parsed: MenuItem[],
  previous: MenuItem[],
  photos: MenuPhoto[],
  exclusions: MenuExclusion[] = [],
): MenuItem[] {
  const merged = parsed
    .filter(
      (item) =>
        !exclusions.some(
          (e) => e.itemId === item.id && e.source === menuSource(item, photos),
        ),
    )
    .map(
      (item) =>
        previous.find(
          (old) =>
            old.id === item.id &&
            old.imageRevision === item.imageRevision &&
            old.lineIds.join("|") === item.lineIds.join("|"),
        ) ?? item,
    );
  const manual = previous.filter(
    (item) =>
      item.id.includes(":manual:") &&
      photos.some(
        (p) => p.id === item.photoId && p.imageRevision === item.imageRevision,
      ),
  );
  if (merged.length + manual.length > 100) throw new Error("MENU_ITEM_LIMIT");
  return [...merged, ...manual];
}

/** Local intent, scoped to the exact raw OCR lines and photo edition. Not product evidence. */
export type MenuExclusion = {
  itemId: string;
  photoId: string;
  imageRevision: number;
  lineIds: string[];
  source: string;
};
export function menuSource(
  item: Pick<MenuItem, "photoId" | "imageRevision" | "lineIds">,
  photos: MenuPhoto[],
): string | null {
  const photo = photos.find(
    (p) => p.id === item.photoId && p.imageRevision === item.imageRevision,
  );
  if (!photo) return null;
  const lines = item.lineIds.map((id) => photo.lines.find((l) => l.id === id));
  if (lines.some((l) => !l)) return null;
  return JSON.stringify([
    photo.id,
    photo.imageRevision,
    lines.map((l) => [l!.id, l!.text]),
  ]);
}
export function activeExclusions(
  input: unknown,
  photos: { id: string; imageRevision: number; ocr: MenuPhoto | null }[],
): MenuExclusion[] {
  if (!Array.isArray(input) || input.length > 500) return [];
  const seen = new Set<string>();
  return input.filter((e): e is MenuExclusion => {
    if (
      !e ||
      typeof e.itemId !== "string" ||
      e.itemId.length > 160 ||
      typeof e.photoId !== "string" ||
      !Number.isInteger(e.imageRevision) ||
      !Array.isArray(e.lineIds) ||
      !e.lineIds.length ||
      e.lineIds.length > 20 ||
      e.lineIds.some(
        (id: unknown) => typeof id !== "string" || id.length > 160,
      ) ||
      typeof e.source !== "string" ||
      e.source.length > 20000 ||
      seen.has(e.itemId)
    )
      return false;
    const photo = photos.find(
      (p) => p.id === e.photoId && p.imageRevision === e.imageRevision,
    );
    if (
      !photo ||
      !e.itemId.startsWith(`${photo.id}:${photo.imageRevision}:`) ||
      (photo.ocr && menuSource(e, [photo.ocr]) !== e.source)
    )
      return false;
    seen.add(e.itemId);
    return true;
  });
}
export function excludeMenuItem<
  T extends {
    items: MenuItem[];
    photos: { id: string; imageRevision: number; ocr: MenuPhoto | null }[];
    exclusions?: MenuExclusion[];
  },
>(draft: T, id: string): T & { exclusions?: MenuExclusion[] } {
  const item = draft.items.find((i) => i.id === id);
  if (!item) return draft;
  const exclusions = activeExclusions(draft.exclusions, draft.photos);
  const source = menuSource(
    item,
    draft.photos.flatMap((p) => (p.ocr ? [p.ocr] : [])),
  );
  if (item.lineIds.length && !source) throw new Error("MENU_SOURCE_MISSING");
  if (source && item.lineIds.length && !exclusions.some((e) => e.itemId === id))
    exclusions.push({
      itemId: id,
      photoId: item.photoId,
      imageRevision: item.imageRevision,
      lineIds: [...item.lineIds],
      source,
    });
  if (exclusions.length > 500) throw new Error("MENU_EXCLUSION_LIMIT");
  return {
    ...draft,
    items: draft.items.filter((i) => i.id !== id),
    exclusions,
  };
}
