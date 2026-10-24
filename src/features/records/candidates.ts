import type { SupabaseClient } from '@supabase/supabase-js';
import type { RepeatEntry } from './repeat';
const kinds:Record<string,NonNullable<RepeatEntry['category']>>={whisky:'위스키',wine:'와인',beer:'맥주',traditional:'전통주',other:'기타'};
export type EntryCandidate=RepeatEntry&{recordCount:number};
export function literalNamePattern(query:string){return `%${query.trim().replace(/[\\%_]/g,char=>`\\${char}`)}%`;}
export async function findEntryCandidates(client:SupabaseClient,owner:string,query:string):Promise<EntryCandidate[]>{
 if(query.trim().length<2)return [];
 const {data,error}=await client.from('cellar_overview').select('id,display_name,category,record_count').eq('user_id',owner).ilike('display_name',literalNamePattern(query)).order('last_consumed_at',{ascending:false}).order('id').limit(5);
 if(error)throw error;
 return (data??[]).map(row=>({id:row.id,name:row.display_name,category:kinds[row.category]??null,recordCount:Number(row.record_count)}));
}
