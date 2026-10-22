import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRecordDetail } from '../src/features/records/detail';
function fixture(fail=false){
 const filters:unknown[][]=[];let index=0;
 const client={from:()=>{const n=index++; const q={select:()=>q,eq:(...args:unknown[])=>{filters.push([n,...args]);return q;},order:()=>q,limit:()=>q,single:async()=>({error:fail?new Error('denied'):null,data:{id:'record',cellar_entry_id:'entry',record_notes:[{confirmed_note:'Kept note',mode:'light',catalog_version:2}],record_photos:[{storage_path:'late',sort_order:2,upload_status:'ready'},{storage_path:'missing',sort_order:0,upload_status:'missing'},{storage_path:'first',sort_order:1,upload_status:'ready'}]}}),then:(resolve:(x:unknown)=>void)=>resolve({data:[{id:'record',consumed_at:'2026-10-19'}],error:null})};return q;},storage:{from:()=>({createSignedUrl:async(path:string)=>({data:{signedUrl:`signed:${path}`},error:null})})}};
 return {client:client as unknown as SupabaseClient,filters};
}
test('detail and history are owner constrained; ready photos use stable sort order',async()=>{const {client,filters}=fixture();const value=await loadRecordDetail(client,'owner',{recordId:'record'});assert.equal(value.photoUri,'signed:first');assert.equal(value.record.record_notes?.confirmed_note,'Kept note');assert.deepEqual(filters,[[0,'user_id','owner'],[0,'id','record'],[1,'user_id','owner'],[1,'cellar_entry_id','entry']]);});
test('cellar entry resolves latest experience within that entry; failures do not show fixtures',async()=>{const {client,filters}=fixture();await loadRecordDetail(client,'owner',{entryId:'entry'});assert.deepEqual(filters[1],[0,'cellar_entry_id','entry']);await assert.rejects(loadRecordDetail(fixture(true).client,'owner',{recordId:'foreign'}));await assert.rejects(loadRecordDetail(client,'owner',{}));});
