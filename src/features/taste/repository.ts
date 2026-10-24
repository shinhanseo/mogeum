import { signPhotoBatch } from "../records/photo-links";
import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeTaste, SUMMARY_VERSION, validateSelection, type SummaryResult } from '../../../supabase/functions/_shared/taste-domain';
import type { TasteContext } from '../../../supabase/functions/_shared/taste-handler';
export { analyzeTaste, selectedFacts, factSentence } from '../../../supabase/functions/_shared/taste-domain';
export type { TasteRecord, TasteFact, TasteAnalysis, TasteSnapshot, SummaryResult } from '../../../supabase/functions/_shared/taste-domain';
export type { TasteContext } from '../../../supabase/functions/_shared/taste-handler';
export async function loadTasteContext(client:SupabaseClient):Promise<TasteContext>{
 const {data,error}=await client.rpc('taste_summary_context').abortSignal(AbortSignal.timeout(20000));if(error)throw error;
 if(!data||!data.snapshot||typeof data.snapshot.hash!=='string'||!Array.isArray(data.snapshot.records)||data.snapshot.records.length>200)throw new Error('Invalid taste context');
 const context=data as TasteContext;const analysis=analyzeTaste(context.snapshot);
 if(context.cached){const value=context.cached as SummaryResult;if(value.version!==SUMMARY_VERSION||typeof value.generatedAt!=='string'||typeof value.model!=='string')throw new Error('Unsupported summary');validateSelection(value.selection,analysis);}
 return context;
}
export async function generateTasteSummary(client:SupabaseClient,owner:string){
 const session=(await client.auth.getSession()).data.session;
 if(!session||session.user.id!==owner)throw Object.assign(new Error('로그인 계정이 바뀌었어요.'),{code:'UNAUTHENTICATED'});
 const {data,error}=await client.functions.invoke('taste-summary',{body:{},timeout:35000,headers:{Authorization:`Bearer ${session.access_token}`}});
 if(error){let code='ANALYSIS_FAILED';try{const response=(error as {context?:Response}).context;if(response){const body=await response.json();if(typeof body.code==='string')code=body.code;}}catch{/* Only map safe machine codes. */}throw Object.assign(new Error('취향 요약을 완료하지 못했어요.'),{code});}
 if(!data||!['ready','running','insufficient'].includes(data.state))throw new Error('Invalid generation response');return data as {state:'ready'|'running'|'insufficient';hash:string};
}
export async function tastePhotoUrls(client: SupabaseClient, owner: string, recordIds: string[]) {
  const ids = [...new Set(recordIds)].slice(0, 200);
  if (!ids.length) return {} as Record<string, string>;
  const { data, error } = await client.from('record_photos').select('record_id,storage_path,sort_order')
    .eq('user_id', owner).eq('upload_status', 'ready').in('record_id', ids).order('sort_order').abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
  const first = new Map<string, string>();
  for (const photo of data ?? []) {
    if (ids.includes(photo.record_id) && typeof photo.storage_path === 'string' &&
        photo.storage_path.startsWith(`${owner}/records/`) && !first.has(photo.record_id))
      first.set(photo.record_id, photo.storage_path);
  }
  if (!first.size) return {} as Record<string, string>;
  const paths = [...new Set(first.values())];
  const byPath = await signPhotoBatch(client, paths);
  return Object.fromEntries([...first].flatMap(([id,path]) => {
    const url = byPath.get(path);
    return url ? [[id,url]] : [];
  })) as Record<string, string>;
}
