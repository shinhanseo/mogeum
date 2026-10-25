import {
  clearProviderCapture,
  captureExistingSession,
} from "./provider-capture-device";
import type { DeletionEvent } from "./deletion-events";
import { resolveDeletionRequest } from "./deletion-request";
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
type Receipt = { owner: string; tokens: string[]; complete: boolean };
const key = deletionReceiptKey;
const validOwner = validDeletionOwner;
export async function readDeletion(owner: string): Promise<Receipt | null> {
  if (!validOwner(owner)) throw Error("INVALID_OWNER");
  const raw = await AsyncStorage.getItem(key(owner));
  if (raw === null) return null;
  if (raw.length > 400000) throw Error("INVALID_RECEIPT");
  const r = JSON.parse(raw);
  if (r && !r.tokens && typeof r.token === "string") r.tokens = [r.token];
  if (
    !r ||
    r.owner !== owner ||
    !Array.isArray(r.tokens) ||
    r.tokens.length === 0 ||
    r.tokens.length > 16 ||
    r.tokens.some(
      (token: unknown) =>
        typeof token !== "string" || token.length === 0 || token.length > 20000,
    ) ||
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
  await clearProviderCapture(owner);
  await AsyncStorage.multiRemove(keys);
}
const pending = new Map<string, Promise<"running" | "complete">>();
const latest = new Map<string, Promise<"running" | "complete">>();
export const latestDeletionTask = (owner: string) => latest.get(owner);
export function requestAccountDeletion(owner: string) {
  const old = pending.get(owner);
  if (old) return old;
  const work = perform(owner);
  pending.set(owner, work);
  latest.set(owner, work);
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
  // A deleted Auth user can no longer refresh; its saved receipt must still be acknowledged.
  if (error && !receipt) throw error;
  if (data.session && data.session.user.id !== owner)
    throw Error("ACCOUNT_CHANGED");
  if (!receipt) {
    if (data.session?.user.id !== owner) throw Error("LOGIN_REQUIRED");
    receipt = { owner, tokens: [data.session.access_token], complete: false };
  }
  if (data.session?.user.id === owner)
    await captureExistingSession(data.session).catch(() => {});
  await AsyncStorage.setItem(key(owner), JSON.stringify(receipt));
  await accountStorage.freeze(owner);
  notifyDeletion({ owner, active: true });
  if (!receipt.complete) {
    const result = await resolveDeletionRequest(
      receipt.tokens,
      data.session?.access_token,
      {
        send: (token) =>
          fetch(`${config.config.url}/functions/v1/delete-account`, {
            method: "POST",
            headers: {
              apikey: config.config.publishableKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ confirm: true }),
            signal: AbortSignal.timeout(55000),
          }),
        persist: async (tokens) => {
          receipt = { ...receipt!, tokens };
          await AsyncStorage.setItem(key(owner), JSON.stringify(receipt));
        },
      },
    );
    if (result.state === "running") return "running";
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
  latest.delete(owner);
  notifyDeletion({ owner, active: false });
  return "complete";
}

const listeners = new Set<(event: DeletionEvent) => void>();
function notifyDeletion(event: DeletionEvent) {
  for (const listener of listeners) listener(event);
}
export function observeDeletion(listener: (event: DeletionEvent) => void) {
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
