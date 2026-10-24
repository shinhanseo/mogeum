import test from 'node:test';
import assert from 'node:assert/strict';
import { basicPatch, editInitial, deleteExperience } from '../src/features/records/edit';
import type { RecordDetail } from '../src/features/records/detail';
import type { SupabaseClient } from '@supabase/supabase-js';
const record:RecordDetail={id:'id',revision:3,cellar_entry_id:'entry',entered_name:'Wine',category:'wine',consumed_at:'2026-10-19T12:34:56Z',revisit:'again',rating:4,vintage_status:'year',vintage_year:2020,record_photos:[],record_notes:null};
test('basic edits preserve experience identity and sensory data; invalid dates/vintages cannot normalize silently',()=>{
 const initial=editInitial(record);const value={...initial,name:'  Changed  ',date:'2024-02-29',vintageStatus:'nv',rating:null};
 const patch=basicPatch(record,value);assert.equal(patch.enteredName,'Changed');assert.equal(patch.vintageYear,null);assert.equal(patch.rating,null);assert.ok(!('recordId' in patch));assert.ok(!('confirmedNote' in patch));assert.equal(record.entered_name,'Wine');
 for(const date of ['2026-02-29','2026-04-31','0000-01-01','2026-1-1'])assert.throws(()=>basicPatch(record,{...initial,date}));
 assert.throws(()=>basicPatch(record,{...initial,vintageYear:'0'}));assert.throws(()=>basicPatch(record,{...initial,name:''}));
});
test('revision guarded delete distinguishes stale records from already deleted retry',async()=>{
 for(const exists of [true,false]){
  const filters:unknown[][]=[];const q={delete:()=>q,eq:(...v:unknown[])=>{filters.push(v);return q;},select:()=>q,maybeSingle:async()=>({data:exists?{id:'id'}:null,error:null}),then:(resolve:(value:unknown)=>void)=>resolve({data:[],error:null})};
  const client={from:()=>q} as unknown as SupabaseClient;
  if(exists)await assert.rejects(deleteExperience(client,'owner',record),{code:'40001'});else await deleteExperience(client,'owner',record);
  assert.deepEqual(filters.slice(0,3),[['user_id','owner'],['id','id'],['revision',3]]);
 }
});
