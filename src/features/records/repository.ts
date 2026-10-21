import type { SupabaseClient } from '@supabase/supabase-js';

export type RecordInput = {
  enteredName?: string; category?: 'whisky' | 'wine' | 'beer' | 'traditional' | 'other';
  consumedAt?: string; revisit?: 'again' | 'okay' | 'not_for_me'; rating?: number;
  vintageStatus?: 'year' | 'nv' | 'unknown'; vintageYear?: number;
  photo?: { storagePath: string; width: number; height: number };
};
export type SavedRecord = { recordId: string; cellarEntryId: string; revision: number; replayed: boolean };

/** Server RLS/RPC authorizes every operation; no body userId is accepted. */
export function createRecordRepository(client: SupabaseClient) {
  return {
    async uploadPhoto(path: string, bytes: ArrayBuffer, contentType: string) {
      const { error } = await client.storage.from('record-photos').upload(path, bytes, { contentType, upsert: false });
      if (error) throw error;
      return path;
    },
    async save(operationId: string, input: RecordInput, entryId: string | null = null): Promise<SavedRecord> {
      // Caller retains operationId + payload across retries, including uncertain network failures.
      const { data, error } = await client.rpc('create_tasting_record', {
        p_operation_id: operationId, p_record: input, p_entry_id: entryId,
      });
      if (error) throw error;
      if (!data || typeof data.recordId !== 'string' || typeof data.cellarEntryId !== 'string' || typeof data.revision !== 'number' || typeof data.replayed !== 'boolean') throw new Error('Invalid record response');
      return data as SavedRecord;
    },
    async listCellar(from = 0, pageSize = 30) {
      if (!Number.isInteger(from) || from < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid page');
      const { data, error } = await client.from('cellar_overview').select('*').order('last_consumed_at', { ascending: false, nullsFirst: false }).order('id').range(from, from + pageSize - 1);
      if (error) throw error;
      return data;
    },
    async photoUrl(path: string) {
      const { data, error } = await client.storage.from('record-photos').createSignedUrl(path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
