import test from 'node:test';
import assert from 'node:assert/strict';
import { literalNamePattern,findEntryCandidates } from '../src/features/records/candidates';
import type { SupabaseClient } from '@supabase/supabase-js';
test('candidate names escape SQL pattern wildcards; blank names do not suggest a shared unknown drink',async()=>{
 assert.equal(literalNamePattern('  100%_\\  '),'%100\\%\\_\\\\%');
 assert.deepEqual(await findEntryCandidates({} as SupabaseClient,'owner',' '),[]);
});
test('candidate search is owner scoped and bounded, never an auto merge',async()=>{
 const calls:unknown[]=[];const q={select:(v:string)=>{calls.push(v);return q;},eq:(...v:unknown[])=>{calls.push(v);return q;},ilike:(...v:unknown[])=>{calls.push(v);return q;},order:()=>q,limit:async(n:number)=>{calls.push(n);return {data:[{id:'entry',display_name:'Whisky',category:'whisky',record_count:3}],error:null};}};
 const client={from:(v:string)=>{calls.push(v);return q;}} as unknown as SupabaseClient;
 const result=await findEntryCandidates(client,'owner','Wh');assert.equal(result[0].recordCount,3);assert.deepEqual(calls,['cellar_overview','id,display_name,category,record_count',['user_id','owner'],['display_name','%Wh%'],5]);
});
