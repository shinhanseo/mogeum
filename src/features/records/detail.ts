import type { SupabaseClient } from '@supabase/supabase-js';
export type RecordDetail = {
  id:string; revision:number; cellar_entry_id:string; entered_name:string|null; category:string|null;
  consumed_at:string; revisit:'again'|'okay'|'not_for_me'|null; rating:number|null;
  vintage_status:string|null; vintage_year:number|null;
  record_photos:{storage_path:string;sort_order:number;upload_status:string}[];
  record_notes:{confirmed_note:string|null;mode:string;catalog_version:number}|null;
};
export async function loadRecordDetail(client:SupabaseClient, owner:string, target:{recordId?:string;entryId?:string}) {
  if(!target.recordId&&!target.entryId)throw new Error('Missing record');
  let query=client.from('tasting_records').select('id,revision,cellar_entry_id,entered_name,category,consumed_at,revisit,rating,vintage_status,vintage_year,record_photos(storage_path,sort_order,upload_status),record_notes(confirmed_note,mode,catalog_version)').eq('user_id',owner);
  query=target.recordId?query.eq('id',target.recordId):query.eq('cellar_entry_id',target.entryId!);
  const {data,error}=await query.order('consumed_at',{ascending:false}).order('id').limit(1).single();
  if(error)throw error;
  const raw=data as unknown as Omit<RecordDetail,'record_notes'> & {record_notes:RecordDetail['record_notes']|NonNullable<RecordDetail['record_notes']>[]};
  // PostgREST returns the reverse composite FK relation as an array, even though record_id is unique.
  const record:RecordDetail={...raw,record_notes:Array.isArray(raw.record_notes)?raw.record_notes[0]??null:raw.record_notes};
  // A bounded history fetch, separately owner constrained, never selects another user's records.
  const {data:history,error:historyError}=await client.from('tasting_records').select('id,consumed_at').eq('user_id',owner).eq('cellar_entry_id',record.cellar_entry_id).order('consumed_at',{ascending:false}).order('id').limit(100);
  if(historyError)throw historyError;
  const photo=record.record_photos.filter(p=>p.upload_status==='ready').sort((a,b)=>a.sort_order-b.sort_order)[0];
  let photoUri:string|null=null;
  if(photo){const {data:signed}=await client.storage.from('record-photos').createSignedUrl(photo.storage_path,300);photoUri=signed?.signedUrl??null;}
  return {record,history:history??[],photoUri};
}
export function recordDate(value:string){return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
