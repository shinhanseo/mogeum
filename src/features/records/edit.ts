import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordDetail } from './detail';
export class EditValidationError extends Error {}
export type BasicEdit={name:string;date:string;revisit:RecordDetail['revisit'];rating:number|null;vintageStatus:RecordDetail['vintage_status'];vintageYear:string};
export function editInitial(record:RecordDetail):BasicEdit{
 const date=new Date(record.consumed_at);
 return {name:record.entered_name??'',date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,revisit:record.revisit,rating:record.rating,vintageStatus:record.vintage_status,vintageYear:record.vintage_year===null?'':String(record.vintage_year)};
}
export function basicPatch(record:RecordDetail,value:BasicEdit){
 if(value.name.trim().length>200)throw new EditValidationError('술 이름은 200자 이내로 적어주세요.');
 if(!value.name.trim()&&!record.record_photos.length)throw new EditValidationError('사진이 없다면 술 이름을 남겨주세요.');
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);if(!match||Number(match[1])<1)throw new EditValidationError('날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
 const date=new Date(record.consumed_at);date.setFullYear(Number(match[1]),Number(match[2])-1,Number(match[3]));
 if(date.getFullYear()!==Number(match[1])||date.getMonth()!==Number(match[2])-1||date.getDate()!==Number(match[3]))throw new EditValidationError('실제 날짜를 확인해주세요.');
 if(value.rating!==null&&(!Number.isInteger(value.rating)||value.rating<1||value.rating>5))throw new EditValidationError('별점을 확인해주세요.');
 if(value.revisit!==null&&!['again','okay','not_for_me'].includes(value.revisit))throw new EditValidationError('평가를 확인해주세요.');
 const patch:{enteredName:string|null;consumedAt:string;revisit:RecordDetail['revisit'];rating:number|null;vintageStatus?:string|null;vintageYear?:number|null}={enteredName:value.name.trim()||null,consumedAt:date.toISOString(),revisit:value.revisit,rating:value.rating};
 if(record.category==='wine'){
  if(value.vintageStatus!==null&&!['year','nv','unknown'].includes(value.vintageStatus))throw new EditValidationError('빈티지를 확인해주세요.');
  const year=Number(value.vintageYear);
  if(value.vintageStatus==='year'&&(!/^\d{1,4}$/.test(value.vintageYear)||year<1||year>9999))throw new EditValidationError('빈티지 연도를 확인해주세요.');
  patch.vintageStatus=value.vintageStatus;patch.vintageYear=value.vintageStatus==='year'?year:null;
 }
 return patch;
}
export async function saveBasicEdit(client:SupabaseClient,record:RecordDetail,value:BasicEdit){
 const {error}=await client.rpc('edit_tasting_record',{p_record_id:record.id,p_expected_revision:record.revision,p_patch:basicPatch(record,value)});
 if(error)throw error;
}
export async function deleteExperience(client:SupabaseClient,owner:string,record:RecordDetail){
 const {data,error}=await client.from('tasting_records').delete().eq('user_id',owner).eq('id',record.id).eq('revision',record.revision).select('id');
 if(error)throw error;
 if(data?.length)return;
 const {data:remaining,error:readError}=await client.from('tasting_records').select('id').eq('user_id',owner).eq('id',record.id).maybeSingle();
 if(readError)throw readError;
 if(remaining)throw Object.assign(new Error('Record changed'),{code:'40001'});
 // An already completed delete after a lost response is safe to acknowledge.
}
export async function drainPhotoDeletions(client:SupabaseClient,owner:string){
 const {data,error}=await client.from('photo_deletion_jobs').select('id,storage_path').eq('user_id',owner).neq('status','done').order('id').limit(20);
 if(error)throw error;
 for(const job of data??[]){
  const {error:removeError}=await client.storage.from('record-photos').remove([job.storage_path]);
  if(removeError)continue;
  // Server rechecks owner and object absence. Failed acknowledgements remain retryable.
  await client.rpc('complete_photo_deletion',{p_job_id:job.id});
 }
}
