import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '../cellar/model';
export type RepeatEntry = { id:string; name:string|null; category:Category|null };
export async function loadRepeatEntry(client:SupabaseClient,owner:string,entryId:string):Promise<RepeatEntry>{
 const {data,error}=await client.from('cellar_entries').select('id,display_name,category').eq('user_id',owner).eq('id',entryId).single();
 if(error)throw error;
 const categories:Record<string,Category>={whisky:'위스키',wine:'와인',beer:'맥주',traditional:'전통주',other:'기타'};
 // Deliberately never read a previous experience: no photograph, vintage or sensory answer can leak in.
 return {id:data.id,name:data.display_name,category:categories[data.category]??null};
}
