import { createClient } from '@supabase/supabase-js';
import { getBackendState } from '../../lib/env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { getSupabase } from '../../lib/supabase';
import { createRecordRepository } from './repository';
import { submitPending, type PendingRecord } from './pending';
const key = (owner: string) => `mogeum-pending-v1-${owner}`;
export async function readPending(owner: string): Promise<PendingRecord | null> {
  const raw = await AsyncStorage.getItem(key(owner));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingRecord;
  if (value.version !== 1 || value.ownerId !== owner || typeof value.operationId !== 'string' || !value.input) throw new Error('저장 중인 기록을 읽지 못했어요.');
  return value;
}
export async function preparePhoto(uri: string, width: number, height: number, operationId: string) {
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  const image = await manipulateAsync(uri, ratio < 1 ? [{ resize: { width: Math.round(width * ratio), height: Math.round(height * ratio) } }] : [], { compress: 0.8, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });
  let localUri = image.uri;
  if (Platform.OS === 'web') localUri = `data:image/jpeg;base64,${image.base64}`;
  else {
    const directory = `${FileSystem.documentDirectory}record-drafts/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    localUri = `${directory}${operationId}.jpg`;
    await FileSystem.copyAsync({ from: image.uri, to: localUri });
  }
  return { localUri, width: image.width, height: image.height };
}
export async function finishPending(pending: PendingRecord) {
  // Remove only the operation that actually completed, never a newer draft.
  const current = await readPending(pending.ownerId);
  if (current?.operationId !== pending.operationId) return;
  await AsyncStorage.removeItem(key(pending.ownerId));
  if (Platform.OS !== 'web' && pending.localPhoto?.startsWith(`${FileSystem.documentDirectory}record-drafts/`)) await FileSystem.deleteAsync(pending.localPhoto, { idempotent: true }).catch(() => {});
}
export async function savePending(pending: PendingRecord, ownerId: () => string | null) {
  const client = getSupabase();
  if (!client) throw new Error('서버 설정을 확인해주세요.');
  const session = (await client.auth.getSession()).data.session;
  const config = getBackendState();
  if (!session || session.user.id !== pending.ownerId || ownerId() !== pending.ownerId || !config.configured) throw new Error('로그인 계정을 확인해주세요.');
  // Pin this attempt to its original account even if the global SDK session changes mid-request.
  const scoped = createClient(config.config.url, config.config.publishableKey, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    global: { headers: { Authorization:`Bearer ${session.access_token}` } },
  });
  const repository = createRecordRepository(scoped);
  return submitPending(pending, {
    ownerId, read: () => readPending(pending.ownerId),
    write: value => AsyncStorage.setItem(key(pending.ownerId), JSON.stringify(value)),
    async upload(path, uri) {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('기기에 보관한 사진을 읽지 못했어요.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('사진은 10MB 이하로 남겨주세요.');
      try { await repository.uploadPhoto(path, bytes, 'image/jpeg'); }
      catch (error) {
        // A repeated upload after a lost response must never overwrite an existing object.
        if (Number((error as { statusCode?: string }).statusCode) !== 409) throw error;
      }
    },
    save: (id, input) => repository.save(id, input),
  });
}
