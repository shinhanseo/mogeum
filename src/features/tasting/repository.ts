import type { SupabaseClient } from '@supabase/supabase-js';
import { serializeAnswers } from './answers';
import type { TastingDraft } from './draft';
export const TASTING_REQUEST_TIMEOUT_MS = 20_000;
export function tastingRepository(client: SupabaseClient, timeoutMs = TASTING_REQUEST_TIMEOUT_MS) {
  return {
    async context(recordId: string) {
      const { data, error } = await client.from('tasting_records').select('id,category,revision,entered_name').eq('id', recordId).abortSignal(AbortSignal.timeout(timeoutMs)).single();
      if (error) throw error;
      return data;
    },
    async save(draft: TastingDraft, operationId: string, expectedRevision: number, note: string, edited: boolean) {
      const { data, error } = await client.rpc('save_tasting_note', {
        p_record_id: draft.recordId, p_operation_id: operationId, p_expected_revision: expectedRevision,
        p_mode: draft.mode, p_catalog_version: draft.catalogVersion, p_answers: serializeAnswers(draft), p_note: note, p_edited: edited,
      }).abortSignal(AbortSignal.timeout(timeoutMs));
      if (error) throw error;
      if (!data || typeof data.recordId !== 'string' || typeof data.revision !== 'number') throw new Error('Invalid note response');
      return data as { recordId: string; revision: number; replayed: boolean };
    },
  };
}
