import type { MenuDraft } from "./device";
import { activeExclusions } from "./review";
import {
  validateItems,
  validatePhotos,
  type MenuPhoto,
} from "../../../supabase/functions/_shared/menu-domain";
import { productCandidates } from "../../../supabase/functions/_shared/product-catalog";
export const MAX_MENU_DRAFT_CHARS = 16000000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function invalid(): never {
  throw new Error("INVALID_MENU_DRAFT");
}
/** Parse without writing/removing anything. A failed read must not become an empty new draft. */
export function parseStoredMenu(
  raw: string,
  owner: string,
  documentDirectory: string,
): MenuDraft {
  if (raw.length > MAX_MENU_DRAFT_CHARS) invalid();
  const d = JSON.parse(raw) as MenuDraft;
  if (
    !d ||
    !uuid.test(d.id) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 0 ||
    !Array.isArray(d.photos) ||
    d.photos.length > 5 ||
    !Array.isArray(d.items) ||
    d.items.length > 100
  )
    invalid();
  const photoIds = new Set<string>();
  for (const p of d.photos) {
    if (
      !p ||
      !uuid.test(p.id) ||
      photoIds.has(p.id) ||
      !Number.isInteger(p.imageRevision) ||
      p.imageRevision < 1 ||
      p.imageRevision > 10000 ||
      !Number.isInteger(p.width) ||
      !Number.isInteger(p.height) ||
      p.width < 1 ||
      p.height < 1 ||
      p.width > 2400 ||
      p.height > 2400 ||
      !["waiting", "reading", "ready", "failed"].includes(p.state) ||
      p.uri !==
        `${documentDirectory}menu-drafts/${owner}/${d.id}/${p.id}-${p.imageRevision}.jpg`
    )
      invalid();
    photoIds.add(p.id);
    if (p.ocr) {
      validatePhotos([p.ocr]);
      if (
        p.ocr.id !== p.id ||
        p.ocr.imageRevision !== p.imageRevision ||
        p.ocr.width !== p.width ||
        p.ocr.height !== p.height
      )
        invalid();
    }
  }
  const itemIds = new Set<string>();
  d.items = d.items.map((item) => {
    const photo = d.photos.find(
      (p) => p.id === item?.photoId && p.imageRevision === item.imageRevision,
    );
    if (
      !photo ||
      itemIds.has(item.id) ||
      !Array.isArray(item.lineIds) ||
      item.lineIds.length > 20 ||
      item.lineIds.some(
        (id) =>
          typeof id !== "string" ||
          id.length > 160 ||
          !id.startsWith(`${photo.id}:${photo.imageRevision}:`),
      )
    )
      invalid();
    itemIds.add(item.id);
    const context: MenuPhoto = photo.ocr ?? {
      id: photo.id,
      imageRevision: photo.imageRevision,
      width: photo.width,
      height: photo.height,
      engine: "manual",
      lines: [],
    };
    // A failed image may have no OCR. Keep its typed input, never treat absent lines as verified source.
    validateItems(
      [photo.ocr ? item : { ...item, lineIds: [] }],
      [context],
      "stored",
      true,
    );
    if (
      item.productId !== null &&
      !productCandidates(item.name).some((p) => p.id === item.productId)
    )
      return { ...item, productId: null, confirmed: false };
    return item;
  });
  if (d.pendingSave) {
    const pending = d.pendingSave;
    if (
      !Number.isSafeInteger(pending.revision) ||
      pending.revision < 0 ||
      pending.revision !== d.revision
    )
      invalid();
    validatePhotos(pending.photos);
    validateItems(pending.items, pending.photos, "stored");
    // Preserve the exact uncertain request even when the current catalog no longer knows its product ID.
  }
  d.exclusions = activeExclusions(d.exclusions, d.photos);
  return d;
}
export type MenuRestoreResult =
  | { status: "empty" }
  | { status: "ready"; draft: MenuDraft }
  | { status: "failed" };
export async function readStoredMenu(
  read: () => Promise<string | null>,
  hydrate: (raw: string) => Promise<MenuDraft>,
): Promise<MenuRestoreResult> {
  try {
    const raw = await read();
    if (raw === null) return { status: "empty" };
    return { status: "ready", draft: await hydrate(raw) };
  } catch {
    return { status: "failed" };
  }
}
