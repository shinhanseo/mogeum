import type { SupabaseClient } from '@supabase/supabase-js';
export type CellarDeletionContext = { entryId: string; deleted: false; name: string | null; count: number; latestRecordId: string | null; snapshot: string } | { entryId: string; deleted: true };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function cellarDeletionContext(client: SupabaseClient, entryId: string): Promise<CellarDeletionContext> {
  if (!uuid.test(entryId)) throw Error('INVALID_ENTRY');
  const { data, error } = await client.rpc('cellar_deletion_context', { p_entry_id: entryId }).abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
  if (!data || data.entryId !== entryId || typeof data.deleted !== 'boolean') throw Error('INVALID_DELETION_CONTEXT');
  if (!data.deleted && (!Number.isInteger(data.count) || data.count < 0 || !/^[a-f0-9]{32}$/.test(data.snapshot) || (data.latestRecordId !== null && !uuid.test(data.latestRecordId)))) throw Error('INVALID_DELETION_CONTEXT');
  return data as CellarDeletionContext;
}
export async function deleteCellarEntry(client: SupabaseClient, owner: string, context: CellarDeletionContext) {
  if (context.deleted) return [] as string[];
  const session = (await client.auth.getSession()).data.session;
  if (session?.user.id !== owner) throw Error('ACCOUNT_CHANGED');
  const { data, error } = await client.rpc('delete_cellar_entry', { p_entry_id: context.entryId, p_expected_snapshot: context.snapshot }).abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
  if (!data || !Array.isArray(data.recordIds) || data.recordIds.some((id: unknown) => typeof id !== 'string' || !uuid.test(id))) throw Error('INVALID_DELETION_RECEIPT');
  return data.recordIds as string[];
}
