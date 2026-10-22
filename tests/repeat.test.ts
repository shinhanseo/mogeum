import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRepeatEntry } from '../src/features/records/repeat';
test('repeat prefill reads only the owner entry identity, not any previous experience',async()=>{
 const calls:unknown[]=[];const q={select:(s:string)=>{calls.push(s);return q;},eq:(...a:unknown[])=>{calls.push(a);return q;},single:async()=>({data:{id:'entry',display_name:'Synthetic whisky',category:'whisky'},error:null})};
 const client={from:(table:string)=>{calls.push(table);return q;}} as unknown as SupabaseClient;
 const entry=await loadRepeatEntry(client,'owner','entry');
 assert.deepEqual(entry,{id:'entry',name:'Synthetic whisky',category:'위스키'});
 assert.deepEqual(calls,['cellar_entries','id,display_name,category',['user_id','owner'],['id','entry']]);
});
