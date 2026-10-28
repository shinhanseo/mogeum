import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';
test('internal research HTTP rejects ordinary Auth and validates admin inputs before provider invocation',{skip:process.env.MOGEUM_TEST_SUPABASE_HTTP!=='1',timeout:30000},async()=>{
 const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(status.API_URL,'http://127.0.0.1:54321');
 const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options),client=createClient(status.API_URL,status.ANON_KEY,options);
 let owner:string|undefined;
 try{
  const signed=await client.auth.signUp({email:`research-${randomUUID()}@example.test`,password:randomUUID()+'Aa1!'});owner=signed.data.user?.id;assert.ok(owner&&signed.data.session);assert.equal(signed.error,null);
  const call=(token:string|undefined)=>fetch(`${status.API_URL}/functions/v1/product-research`,{method:'POST',headers:{apikey:status.ANON_KEY,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({name:'Synthetic malt',category:'whisky',edition:null,userId:'forbidden'}),signal:AbortSignal.timeout(10000)});
  for(const token of [undefined,status.ANON_KEY,status.PUBLISHABLE_KEY,signed.data.session!.access_token])assert.equal((await call(token)).status,401);
  // Correct admin secret with forbidden input still cannot reach the provider or spend a reservation.
  assert.equal((await call(status.SERVICE_ROLE_KEY)).status,400);
  const denied=await client.rpc('begin_product_research',{p_hash:'a'.repeat(64),p_lease:randomUUID()});assert.ok(denied.error);
 }finally{if(owner)assert.equal((await admin.auth.admin.deleteUser(owner)).error,null);}
});
