import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { proseFixture } from '../src/dev/tasting-prose-fixture';
import { composeNote } from '../src/features/tasting/answers';
import { tastingRepository } from '../src/features/tasting/repository';
import { loadRecordDetail } from '../src/features/records/detail';
test('four deep tasting notes survive real save, replay and fresh detail read without list labels',{
 skip:process.env.MOGEUM_TEST_SUPABASE_HTTP!=='1'?'Needs isolated local Supabase HTTP':false,timeout:60000
},async()=>{
 const status=JSON.parse(execFileSync(resolve('node_modules/.bin/supabase'),['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(status.API_URL,'http://127.0.0.1:54321');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const sdk=createClient(status.API_URL,status.ANON_KEY,options);
 const signup=await sdk.auth.signUp({email:`prose-${randomUUID()}@example.test`,password:randomUUID()+'Aa1!'});
 assert.equal(signup.error,null);const owner=signup.data.user!.id;
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options);
 try{
  for(const category of ['whisky','wine','beer','traditional'] as const){
   const created=await sdk.rpc('create_tasting_record',{p_operation_id:randomUUID(),p_record:{enteredName:`합성 ${category}`,category,revisit:'again'}});
   assert.equal(created.error,null);const recordId=created.data.recordId;
   const draft=proseFixture(owner,recordId,category), note=composeNote(draft), operation=randomUUID();
   assert.ok(note.length>30&&!note.includes(':')&&!note.includes('\n'));
   const repository=tastingRepository(sdk);
   const saved=await repository.save(draft,operation,created.data.revision,note,false);
   assert.equal((await repository.save(draft,operation,created.data.revision,note,false)).replayed,true);
   const detail=await loadRecordDetail(sdk,owner,{recordId});
   assert.equal(detail.record.record_notes?.confirmed_note,note);
   assert.equal(detail.record.revision,saved.revision);
   const edited='내가 직접 남긴 표현은 그대로.\n줄바꿈도 유지해요.';
   await repository.save(draft,randomUUID(),saved.revision,edited,true);
   assert.equal((await loadRecordDetail(sdk,owner,{recordId})).record.record_notes?.confirmed_note,edited);
  }
 }finally{const removed=await admin.auth.admin.deleteUser(owner);assert.equal(removed.error,null);}
});
