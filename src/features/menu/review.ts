import type {
  MenuItem,
  MenuPhoto,
} from "../../../supabase/functions/_shared/menu-domain";
/** A review may only survive if both its item identity and exact OCR source still match. */
export function mergeMenuReview(
  parsed: MenuItem[],
  previous: MenuItem[],
  photos: MenuPhoto[],
): MenuItem[] {
  const merged = parsed.map(
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
