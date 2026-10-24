import type { SupabaseClient } from '@supabase/supabase-js';
export type AttachmentChange={kind:'photo';storagePath:string;width:number;height:number}|{kind:'move';entryId:string}|{kind:'split';name:string|null};
export type AttachmentResult={recordId:string;cellarEntryId:string;revision:number;replayed:boolean};
export type PendingAttachment={version:1;owner:string;recordId:string;operationId:string;expectedRevision:number;change:AttachmentChange;localPhoto?:string;result?:AttachmentResult};
export type AttachmentPorts={owner:()=>string|null;read:()=>Promise<PendingAttachment|null>;write:(value:PendingAttachment)=>Promise<void>;upload:(path:string,localUri:string)=>Promise<void>;apply:(value:PendingAttachment)=>Promise<AttachmentResult>};
export function decodePendingAttachment(raw:string,owner:string,recordId:string):PendingAttachment{
 const value=JSON.parse(raw) as PendingAttachment;
 const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 if(value.version!==1||value.owner!==owner||value.recordId!==recordId||!uuid(value.operationId)||!Number.isInteger(value.expectedRevision)||value.expectedRevision<1||!value.change)throw new Error('보관한 변경 요청을 읽지 못했어요.');
 const c=value.change;
 if(c.kind==='photo'){
  if(!c.storagePath.startsWith(`${owner}/records/${value.operationId}/`)||c.storagePath.includes('..')||!Number.isInteger(c.width)||!Number.isInteger(c.height)||c.width<1||c.height<1||c.width>20000||c.height>20000||typeof value.localPhoto!=='string')throw new Error('보관한 사진을 확인해주세요.');
 }else if(c.kind==='move'){if(!uuid(c.entryId))throw new Error('이동할 술장을 확인해주세요.');}
 else if(c.kind==='split'){if(c.name!==null&&(typeof c.name!=='string'||c.name.length>200))throw new Error('새 술 이름을 확인해주세요.');}
 else throw new Error('지원하지 않는 변경 요청이에요.');
 if(value.result&&(value.result.recordId!==recordId||!uuid(value.result.cellarEntryId)||!Number.isInteger(value.result.revision)||value.result.revision<1||typeof value.result.replayed!=='boolean'))throw new Error('보관한 변경 결과를 확인해주세요.');
 return value;
}
export async function submitAttachment(value:PendingAttachment,ports:AttachmentPorts){
 const check=()=>{if(ports.owner()!==value.owner)throw new Error('로그인 계정이 변경됐어요.');};check();
 const existing=await ports.read();
 const identity=(v:PendingAttachment)=>JSON.stringify([v.owner,v.recordId,v.operationId,v.expectedRevision,v.change,v.localPhoto]);
 if(existing&&identity(existing)!==identity(value))throw new Error('저장 중인 원래 변경을 먼저 완료해주세요.');
 check();const receipt=existing?.result??value.result;if(receipt)return receipt;await ports.write(value);
 if(value.change.kind==='photo'&&value.localPhoto){check();await ports.upload(value.change.storagePath,value.localPhoto);}
 check();const result=await ports.apply(value);await ports.write({...value,result});check();return result;
}
export async function applyAttachment(client:SupabaseClient,value:PendingAttachment):Promise<AttachmentResult>{
 const {data,error}=await client.rpc('change_record_attachment',{p_record_id:value.recordId,p_operation_id:value.operationId,p_expected_revision:value.expectedRevision,p_change:value.change});
 if(error)throw error;
 if(!data||data.recordId!==value.recordId||typeof data.cellarEntryId!=='string'||!Number.isInteger(data.revision)||typeof data.replayed!=='boolean')throw new Error('변경 결과를 확인하지 못했어요.');
 return data as AttachmentResult;
}
export async function listMoveTargets(client:SupabaseClient,owner:string,excluded:string,query:string,from=0){
 if(!Number.isInteger(from)||from<0)throw new Error('Invalid page');
 let request=client.from('cellar_overview').select('id,display_name,category,record_count').eq('user_id',owner).neq('id',excluded);
 if(query.trim())request=request.ilike('display_name',`%${query.trim().replace(/[\\%_]/g,c=>`\\${c}`)}%`);
 const {data,error}=await request.order('last_consumed_at',{ascending:false}).order('id').range(from,from+29);
 if(error)throw error;return data??[];
}
