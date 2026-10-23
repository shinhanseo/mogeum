import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { recognizeMenu } from "../../../modules/menu-ocr";
import {
  validatePhotos,
  validateItems,
  type MenuPhoto,
  type MenuItem,
} from "../../../supabase/functions/_shared/menu-domain";
export type DevicePhoto = {
  id: string;
  imageRevision: number;
  uri: string;
  width: number;
  height: number;
  state: "waiting" | "reading" | "ready" | "failed";
  ocr: MenuPhoto | null;
};
export type MenuDraft = {
  id: string;
  revision: number;
  photos: DevicePhoto[];
  items: MenuItem[];
  pendingSave?: { revision: number; photos: MenuPhoto[]; items: MenuItem[] };
};
const key = (owner: string) => `mogeum:menu:v1:${owner}`;
export function newMenu(): MenuDraft {
  return { id: randomUUID(), revision: 0, photos: [], items: [] };
}
export async function prepareMenuPhoto(
  owner: string,
  sessionId: string,
  uri: string,
  id = randomUUID(),
  imageRevision = 1,
): Promise<DevicePhoto> {
  const image = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const longest = Math.max(image.width, image.height);
  const sized =
    longest > 2200
      ? await ImageManipulator.manipulateAsync(
          image.uri,
          [
            {
              resize:
                image.width >= image.height
                  ? { width: 2200 }
                  : { height: 2200 },
            },
          ],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        )
      : image;
  const directory = `${FileSystem.documentDirectory}menu-drafts/${owner}/${sessionId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const target = `${directory}${id}-${imageRevision}.jpg`;
  await FileSystem.copyAsync({ from: sized.uri, to: target });
  return {
    id,
    imageRevision,
    uri: target,
    width: sized.width,
    height: sized.height,
    state: "waiting",
    ocr: null,
  };
}
export async function readMenuPhoto(photo: DevicePhoto): Promise<DevicePhoto> {
  const result = await recognizeMenu(photo.uri);
  if (result.width !== photo.width || result.height !== photo.height)
    throw new Error("OCR_ORIENTATION");
  const ocr: MenuPhoto = {
    id: photo.id,
    imageRevision: photo.imageRevision,
    width: result.width,
    height: result.height,
    engine: result.engine,
    lines: result.lines
      .filter((l) => l.text.trim())
      .map((l, index) => ({
        ...l,
        id: `${photo.id}:${photo.imageRevision}:${index}`,
      })),
  };
  validatePhotos([ocr]);
  if (!ocr.lines.length) throw new Error("OCR_EMPTY");
  return { ...photo, state: "ready", ocr };
}
export async function persistMenu(owner: string, draft: MenuDraft) {
  await AsyncStorage.setItem(key(owner), JSON.stringify(draft));
  // Prune superseded local image revisions only after the new draft is durable.
  const directory = `${FileSystem.documentDirectory}menu-drafts/${owner}/${draft.id}/`;
  const keep = new Set(draft.photos.map((p) => p.uri));
  try {
    for (const name of await FileSystem.readDirectoryAsync(directory)) {
      const uri = directory + name;
      if (/^[0-9a-f-]+-\d+\.jpg$/i.test(name) && !keep.has(uri))
        await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    /* Storage cleanup does not discard a successfully written draft. */
  }
}
export async function restoreMenu(owner: string): Promise<MenuDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(owner));
    if (!raw) return null;
    const d = JSON.parse(raw) as MenuDraft;
    if (
      !/^[0-9a-f-]{36}$/i.test(d.id) ||
      !Number.isInteger(d.revision) ||
      d.revision < 0 ||
      !Array.isArray(d.photos) ||
      d.photos.length > 5 ||
      !Array.isArray(d.items)
    )
      return null;
    for (const p of d.photos) {
      if (
        !/^[0-9a-f-]{36}$/i.test(p.id) ||
        !Number.isInteger(p.imageRevision) ||
        p.imageRevision < 1 ||
        !["waiting", "reading", "ready", "failed"].includes(p.state) ||
        p.uri !==
          `${FileSystem.documentDirectory}menu-drafts/${owner}/${d.id}/${p.id}-${p.imageRevision}.jpg`
      )
        return null;
      if (p.ocr) {
        validatePhotos([p.ocr]);
        if (p.ocr.id !== p.id || p.ocr.imageRevision !== p.imageRevision)
          return null;
      }
      const exists = await FileSystem.getInfoAsync(p.uri);
      if (!exists.exists) {
        p.state = "failed";
        p.ocr = null;
      }
      if (p.state === "reading") p.state = "waiting";
    }
    if (d.pendingSave) {
      validatePhotos(d.pendingSave.photos);
      validateItems(d.pendingSave.items, d.pendingSave.photos);
      if (
        !Number.isInteger(d.pendingSave.revision) ||
        d.pendingSave.revision < 0
      )
        return null;
    }
    return d;
  } catch {
    return null;
  }
}
