import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {cellarDeletionContext,deleteCellarEntry} from '../src/features/cellar/deletion';
import {drainPhotoDeletions} from '../src/features/records/edit';
test('whole-drink REST deletion preserves another owner and cleans actual fixture Storage; lost response retries use the same IDs',{skip:process.env.MOGEUM_TEST_SUPABASE_HTTP!=='1'?'Needs disposable loopback Supabase Auth/Storage':false,timeout:60000},async()=>{
 const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(status.API_URL,'http://127.0.0.1:54321');
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY??status.SECRET_KEY,options);
 const users:string[]=[],paths:string[]=[];
 try{
  const sessions=[];
  for(let n=0;n<2;n++){
   const email=`cellar-delete-${randomUUID()}@example.test`,password=randomUUID()+'Aa1!';
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);users.push(created.data.user!.id);
   const client=createClient(status.API_URL,status.ANON_KEY??status.PUBLISHABLE_KEY,options);const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);sessions.push(client);
  }
  const [a,b]=sessions;
  const save=async(client:typeof a,entry:string|null=null,photo?:{storagePath:string;width:number;height:number})=>{
   const r=await client.rpc('create_tasting_record',{p_operation_id:randomUUID(),p_record:{enteredName:'Synthetic deletion QA',category:'whisky',...(photo?{photo}:{})},p_entry_id:entry});assert.ifError(r.error);return r.data as {recordId:string;cellarEntryId:string};
  };
  const path=`${users[0]}/records/${randomUUID()}/photo.jpg`;paths.push(path);
  const upload=await a.storage.from('record-photos').upload(path,await readFile('assets/fixtures/figma-whisky.jpg'),{contentType:'image/jpeg'});assert.ifError(upload.error);
  const one=await save(a,null,{storagePath:path,width:384,height:512}),two=await save(a,one.cellarEntryId),foreign=await save(b);
  const before=await cellarDeletionContext(a,one.cellarEntryId);assert.equal(before.deleted,false);if(before.deleted)throw Error('unexpected');assert.equal(before.count,2);
  await assert.rejects(cellarDeletionContext(b,one.cellarEntryId),e=>(e as {code:string}).code==='P0002');
  const third=await save(a,one.cellarEntryId);
  await assert.rejects(deleteCellarEntry(a,users[0],before),e=>(e as {code:string}).code==='40001');
  const confirmed=await cellarDeletionContext(a,one.cellarEntryId);
  const deleted=await deleteCellarEntry(a,users[0],confirmed);assert.deepEqual(deleted.sort(),[one.recordId,two.recordId,third.recordId].sort());
  assert.deepEqual((await deleteCellarEntry(a,users[0],confirmed)).sort(),deleted);
  assert.equal((await cellarDeletionContext(a,one.cellarEntryId)).deleted,true);
  assert.equal((await b.from('tasting_records').select('id').eq('id',foreign.recordId)).data?.length,1);
  await drainPhotoDeletions(a,users[0],async()=>{});
  const files=await admin.storage.from('record-photos').list(path.slice(0,path.lastIndexOf('/')));assert.ifError(files.error);assert.equal(files.data?.length,0);
 }finally{
  if(paths.length)await admin.storage.from('record-photos').remove(paths);
  for(const id of users)await admin.auth.admin.deleteUser(id);
 }
});
