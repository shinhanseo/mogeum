import { type MenuRestoreResult } from "./restore";
import { createMenuStore } from "./storage";
import { type MenuExclusion } from "./review";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { recognizeMenu } from "../../../modules/menu-ocr";
import {
  validatePhotos,
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
  exclusions?: MenuExclusion[];
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
export async function readMenuPhoto(
  photo: DevicePhoto,
  observeNative?: (result: Awaited<ReturnType<typeof recognizeMenu>>) => void,
): Promise<DevicePhoto> {
  const result = await recognizeMenu(photo.uri);
  observeNative?.(result);
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
const menuStore = createMenuStore({
  directory: FileSystem.documentDirectory!,
  read: (owner) => AsyncStorage.getItem(key(owner)),
  write: (owner, raw) => AsyncStorage.setItem(key(owner), raw),
  list: (directory) => FileSystem.readDirectoryAsync(directory),
  remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
  async hydrate(d) {
    for (const p of d.photos) {
      const exists = await FileSystem.getInfoAsync(p.uri);
      if (!exists.exists) {
        p.state = "failed";
        p.ocr = null;
      } else if (p.state === "reading") p.state = "waiting";
      else if (p.state === "ready" && !p.ocr) p.state = "failed";
    }
    return d;
  },
});
export function persistMenu(owner: string, draft: MenuDraft): Promise<void> {
  return menuStore.save(owner, draft);
}
export function restoreMenu(owner: string): Promise<MenuRestoreResult> {
  return menuStore.load(owner);
}
