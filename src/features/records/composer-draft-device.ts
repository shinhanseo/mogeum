import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { accountStorage } from "../auth/account-storage";
import { createPhotoPreparationQueue } from "../menu/preparation";
import {
  composerPhotoUri,
  composerStorageKey,
  createComposerDraftStorage,
  type ComposerPhoto,
  type RecordComposerDraft,
} from "./composer-draft";
import { isPreparedRecordPhoto } from "./draft-photo";
export const composerDraftStorage = createComposerDraftStorage(accountStorage);
export const composerPhotoQueue = createPhotoPreparationQueue();
export const composerDraftSupported = Platform.OS !== "web";
export async function restoreComposerPhoto(
  owner: string,
  photo: ComposerPhoto,
) {
  const uri = composerPhotoUri(FileSystem.documentDirectory, owner, photo.id);
  if (!(await FileSystem.getInfoAsync(uri)).exists)
    throw Error("COMPOSER_PHOTO_MISSING");
  return { uri, width: photo.width, height: photo.height };
}
export async function prepareComposerPhoto(
  owner: string,
  id: string,
  asset: { uri: string; width: number; height: number },
) {
  const target = composerPhotoUri(FileSystem.documentDirectory, owner, id);
  if (
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.width < 1 ||
    asset.height < 1
  )
    throw Error("INVALID_COMPOSER_PHOTO");
  const ratio = Math.min(1, 1600 / Math.max(asset.width, asset.height));
  const image = await manipulateAsync(
    asset.uri,
    ratio < 1
      ? [
          {
            resize: {
              width: Math.max(1, Math.round(asset.width * ratio)),
              height: Math.max(1, Math.round(asset.height * ratio)),
            },
          },
        ]
      : [],
    { compress: 0.8, format: SaveFormat.JPEG },
  );
  await FileSystem.makeDirectoryAsync(
    target.slice(0, target.lastIndexOf("/") + 1),
    { intermediates: true },
  );
  try {
    await FileSystem.copyAsync({ from: image.uri, to: target });
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    throw error;
  }
  return {
    photo: { id, width: image.width, height: image.height },
    asset: { uri: target, width: image.width, height: image.height },
  };
}
export async function removeComposerPhoto(owner: string, photo: ComposerPhoto) {
  await FileSystem.deleteAsync(
    composerPhotoUri(FileSystem.documentDirectory, owner, photo.id),
    { idempotent: true },
  );
}
export async function composerPhotoForPending(
  owner: string,
  photo: ComposerPhoto,
  operationId: string,
) {
  const source = await restoreComposerPhoto(owner, photo);
  const target = `${FileSystem.documentDirectory}record-drafts/${operationId}.jpg`;
  if (!isPreparedRecordPhoto(target, operationId, FileSystem.documentDirectory))
    throw Error("INVALID_PREPARED_PHOTO");
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}record-drafts/`,
    { intermediates: true },
  );
  try {
    await FileSystem.copyAsync({ from: source.uri, to: target });
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    throw error;
  }
  return { localUri: target, width: photo.width, height: photo.height };
}
export async function finishComposerDraft(value: RecordComposerDraft) {
  return composerDraftStorage.finish(value, async () => {
    if (value.photo) await removeComposerPhoto(value.ownerId, value.photo);
  });
}
/** Freeze/drain in-flight image work before removing only this account's directory. */
export async function clearComposerPhotos(owner: string) {
  composerStorageKey(owner, "new");
  await composerPhotoQueue.freeze(owner);
  if (Platform.OS !== "web")
    await FileSystem.deleteAsync(
      `${FileSystem.documentDirectory}record-composer-drafts/${owner}/`,
      { idempotent: true },
    );
}
