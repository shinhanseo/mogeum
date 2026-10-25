import { menuPhotoPreparationQueue } from "../menu/preparation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getSupabase } from "../../lib/supabase";
import { getBackendState } from "../../lib/env";
import {
  deletedAccountKeys,
  validDeletionOwner,
  deletionReceiptKey,
} from "./deletion-local";
import { accountStorage } from "./account-storage";
import { decodePendingRecord } from "../records/pending-restore";
import { decodePreparedAttachment } from "../records/attachment-restore";
import { isPreparedRecordPhoto } from "../records/draft-photo";
type Receipt = { owner: string; token: string; complete: boolean };
const key = deletionReceiptKey;
const validOwner = validDeletionOwner;
export async function readDeletion(owner: string): Promise<Receipt | null> {
  if (!validOwner(owner)) throw Error("INVALID_OWNER");
  const raw = await AsyncStorage.getItem(key(owner));
  if (raw === null) return null;
  const r = JSON.parse(raw);
  if (
    r.owner !== owner ||
    typeof r.token !== "string" ||
    r.token.length === 0 ||
    r.token.length > 20000 ||
    typeof r.complete !== "boolean"
  )
    throw Error("INVALID_RECEIPT");
  return r;
}
export async function currentDeletionStatus(owner: string) {
  if (await readDeletion(owner)) return true;
  const client = getSupabase();
  if (!client) throw Error("NO_BACKEND");
  const { data, error } = await client
    .rpc("account_deletion_status")
    .abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return data === "pending";
}
async function cleanup(owner: string) {
  await accountStorage.freeze(owner);
  await menuPhotoPreparationQueue.freeze(owner);
  const keys = deletedAccountKeys(owner, await AsyncStorage.getAllKeys());
  for (const storageKey of keys) {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) continue;
    let photo: string | undefined, operation: string | undefined;
    try {
      if (storageKey === `mogeum-pending-v1-${owner}`) {
        const p = decodePendingRecord(
          raw,
          owner,
          FileSystem.documentDirectory,
          Platform.OS === "web",
        );
        photo = p.localPhoto;
        operation = p.operationId;
      } else if (storageKey.startsWith(`mogeum-attachment-v1-${owner}-`)) {
        const p = decodePreparedAttachment(
          raw,
          owner,
          storageKey.slice(`mogeum-attachment-v1-${owner}-`.length),
          FileSystem.documentDirectory,
          Platform.OS === "web",
        );
        photo = p.localPhoto;
        operation = p.operationId;
      }
    } catch {
      /* Corrupt metadata cannot authorize removing an arbitrary file. */
    }
    if (
      photo &&
      operation &&
      Platform.OS !== "web" &&
      isPreparedRecordPhoto(photo, operation, FileSystem.documentDirectory)
    )
      await FileSystem.deleteAsync(photo, { idempotent: true });
  }
  if (FileSystem.documentDirectory && Platform.OS !== "web")
    await FileSystem.deleteAsync(
      `${FileSystem.documentDirectory}menu-drafts/${owner}/`,
      { idempotent: true },
    );
  await AsyncStorage.multiRemove(keys);
}
const pending = new Map<string, Promise<"running" | "complete">>();
export function requestAccountDeletion(owner: string) {
  const old = pending.get(owner);
  if (old) return old;
  const work = perform(owner);
  pending.set(owner, work);
  void work
    .finally(() => {
      if (pending.get(owner) === work) pending.delete(owner);
    })
    .catch(() => {});
  return work;
}
async function perform(owner: string): Promise<"running" | "complete"> {
  if (!validOwner(owner)) throw Error("INVALID_OWNER");
  const client = getSupabase(),
    config = getBackendState();
  if (!client || !config.configured) throw Error("NO_BACKEND");
  let receipt = await readDeletion(owner);
  // Do not persist an irreversible local workflow before the server migration is available.
  if (!receipt) await currentDeletionStatus(owner);
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session && data.session.user.id !== owner)
    throw Error("ACCOUNT_CHANGED");
  if (!receipt) {
    if (data.session?.user.id !== owner) throw Error("LOGIN_REQUIRED");
    receipt = { owner, token: data.session.access_token, complete: false };
  } else if (!receipt.complete && data.session?.user.id === owner)
    receipt = { ...receipt, token: data.session.access_token };
  await AsyncStorage.setItem(key(owner), JSON.stringify(receipt));
  await accountStorage.freeze(owner);
  notifyDeletion(owner);
  if (!receipt.complete) {
    const response = await fetch(
      `${config.config.url}/functions/v1/delete-account`,
      {
        method: "POST",
        headers: {
          apikey: config.config.publishableKey,
          Authorization: `Bearer ${receipt.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
        signal: AbortSignal.timeout(55000),
      },
    );
    if (!response.ok)
      throw Error(
        response.status === 401 ? "LOGIN_REQUIRED" : "DELETION_RETRY_REQUIRED",
      );
    const result = await response.json();
    if (result.state === "running") return "running";
    if (result.state !== "complete") throw Error("INVALID_RESPONSE");
    receipt = { ...receipt, complete: true };
    await AsyncStorage.setItem(key(owner), JSON.stringify(receipt));
  }
  await cleanup(owner);
  // Auth removal can invalidate the session before local cleanup finishes. Never sign out a different login.
  const now = await client.auth.getSession();
  if (now.error) throw Error("LOCAL_SIGNOUT_FAILED");
  if (now.data.session?.user.id === owner) {
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) throw Error("LOCAL_SIGNOUT_FAILED");
  }
  await AsyncStorage.removeItem(key(owner));
  notifyDeletion(null);
  return "complete";
}

const listeners = new Set<(owner: string | null) => void>();
function notifyDeletion(owner: string | null) {
  for (const listener of listeners) listener(owner);
}
export function observeDeletion(listener: (owner: string | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function storedDeletionOwners() {
  return (await AsyncStorage.getAllKeys())
    .filter((k) => k.startsWith("mogeum-delete-v1-"))
    .map((k) => k.slice("mogeum-delete-v1-".length))
    .filter(validOwner);
}
