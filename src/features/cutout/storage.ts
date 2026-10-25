import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { accountStorage } from "../auth/account-storage";
import { validDeletionOwner } from "../auth/deletion-local";
import { getSupabase } from "../../lib/supabase";
import type { CutoutImage } from "./native";
import { decodeCutoutCache, validateCutoutSource } from "./cache-contract";
export const localCutoutKey = (owner: string) => `mogeum:cutout:v1:${owner}`;
let tail: Promise<unknown> = Promise.resolve();
async function digest(source: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, source);
}
async function activeOwner(owner: string) {
  const client = getSupabase();
  return (
    !!client && (await client.auth.getSession()).data.session?.user.id === owner
  );
}
async function map(owner: string) {
  return decodeCutoutCache(
    await accountStorage.getItem(localCutoutKey(owner)),
    owner,
  );
}
/** Local presentation derivative only; source paths are revalidated by the caller's DB read. */
export async function readLocalCutout(owner: string, source: string) {
  validateCutoutSource(owner, source);
  const id = await digest(source);
  const value = (await map(owner))[id];
  if (!value || value.source !== source || value.file !== `${id}.png`)
    return null;
  const uri = `${FS.cacheDirectory}cellar-cutouts/${owner}/${value.file}`;
  return (await FS.getInfoAsync(uri)).exists ? uri : null;
}
export function saveLocalCutout(
  owner: string,
  source: string,
  value: CutoutImage | null,
) {
  const task = tail
    .catch(() => {})
    .then(async () => {
      validateCutoutSource(owner, source);
      if (!(await activeOwner(owner))) throw Error("ACCOUNT_CHANGED");
      const id = await digest(source),
        items = await map(owner);
      const directory = `${FS.cacheDirectory}cellar-cutouts/${owner}/`,
        target = `${directory}${id}.png`;
      if (value) {
        if (!value.uri.startsWith(`${FS.cacheDirectory}background-removal/`))
          throw Error("INVALID_DERIVATIVE");
        await FS.makeDirectoryAsync(directory, { intermediates: true });
        await FS.copyAsync({ from: value.uri, to: target });
        items[id] = { source, file: `${id}.png` };
      } else delete items[id];
      if (!(await activeOwner(owner))) {
        if (value) await FS.deleteAsync(target, { idempotent: true });
        throw Error("ACCOUNT_CHANGED");
      }
      try {
        await accountStorage.setItem(
          localCutoutKey(owner),
          JSON.stringify(items),
        );
      } catch (e) {
        if (value) await FS.deleteAsync(target, { idempotent: true });
        throw e;
      }
      if (!value) await FS.deleteAsync(target, { idempotent: true });
    });
  tail = task;
  return task;
}
export async function clearLocalCutouts(owner: string) {
  await tail.catch(() => {});
  if (!validDeletionOwner(owner)) throw Error("INVALID_OWNER");
  await accountStorage.removeItem(localCutoutKey(owner));
  await FS.deleteAsync(`${FS.cacheDirectory}cellar-cutouts/${owner}/`, {
    idempotent: true,
  });
}
