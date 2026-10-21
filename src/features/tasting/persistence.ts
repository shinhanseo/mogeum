import AsyncStorage from '@react-native-async-storage/async-storage';
import { type TastingDraft } from './draft';
import { parseTastingDraft } from './validate-draft';
const key = (owner: string, record: string) => `mogeum-tasting-v1-${owner}-${record}`;
const queues = new Map<string, Promise<void>>();

/** Serialize writes: an older keystroke must never overwrite a more recent draft. */
export function persistDraft(draft: TastingDraft): Promise<void> {
  const storageKey = key(draft.ownerId, draft.recordId);
  const raw = JSON.stringify(draft);
  if (raw.length > 100000) return Promise.reject(new Error('Draft is too large'));
  const pending = (queues.get(storageKey) ?? Promise.resolve()).catch(() => {}).then(() => AsyncStorage.setItem(storageKey, raw));
  queues.set(storageKey, pending);
  void pending.finally(() => { if (queues.get(storageKey) === pending) queues.delete(storageKey); }).catch(() => {});
  return pending;
}
export async function restoreDraft(owner: string, record: string): Promise<TastingDraft | null> {
  const raw = await AsyncStorage.getItem(key(owner, record));
  if (!raw) return null;
  return parseTastingDraft(raw,owner,record);
}
export async function clearDraft(owner: string, record: string) {
  const storageKey = key(owner, record);
  await queues.get(storageKey)?.catch(() => {});
  await AsyncStorage.removeItem(storageKey);
}
