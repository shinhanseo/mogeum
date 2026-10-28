import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {runProductResearch, type ResearchPorts} from '../supabase/functions/_shared/research-runner';
const query={name:'합성 제품',category:'whisky' as const,edition:null};
const candidate={status:'candidate' as const,query,text:'과일 향.',sources:[{index:0,url:'https://www.example.com/product',title:'합성 출처'}],supports:[{text:'과일 향.',sourceIndices:[0]}],queries:['synthetic product'],searchEntryPointHtml:null};
test('research runner reserves before provider, validates cache and never calls provider when blocked',async()=>{
 let calls=0,finishes=0;
 const ports:ResearchPorts={version:'test-model-contract-v1',begin:async()=>({state:'acquired'}),finish:async()=>{finishes++;return true;},research:async()=>{calls++;return {research:candidate};}};
 const result=await runProductResearch(query,ports);assert.equal(result.state,'candidate');assert.equal(calls,1);assert.equal(finishes,1);
 for(const state of ['running','backoff','busy','daily-limit','monthly-limit','provider-backoff'])assert.equal((await runProductResearch(query,{...ports,begin:async()=>({state})})).state,state);
 assert.equal(calls,1);
 assert.equal((await runProductResearch(query,{...ports,begin:async()=>({state:'cached',result:candidate})})).state,'candidate');assert.equal(calls,1);
 await assert.rejects(runProductResearch(query,{...ports,begin:async()=>({state:'cached',result:{...candidate,query:{...query,name:'다른 제품'}}})}));
 await assert.rejects(runProductResearch({...query,userId:'private'},ports));assert.equal(calls,1);
 await assert.rejects(runProductResearch(query,{...ports,research:async()=>{throw new Error('synthetic failure');}}));assert.equal(finishes,2);
});
test('durable research budget isolates service RPCs, caches candidates and enforces global attempt limits',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec('create schema private;create role anon;create role authenticated;create role service_role;grant usage on schema public to anon,authenticated,service_role;');
  await db.exec(await readFile('supabase/migrations/20261027030000_product_research_budget.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261028010000_research_provider_backoff.sql','utf8'));
  const hash=(n:number)=>n.toString(16).padStart(64,'0');
  const begin=async(n:number,lease=randomUUID())=>(await db.query<{result:{state:string;result?:unknown}}>('select public.begin_product_research($1,$2) result',[hash(n),lease])).rows[0].result;
  const finish=async(n:number,lease:string,result:unknown)=>(await db.query<{result:boolean}>('select public.finish_product_research($1,$2,$3::jsonb) result',[hash(n),lease,result===null?null:JSON.stringify(result)])).rows[0].result;
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);await assert.rejects(begin(1));await assert.rejects(db.query('select * from private.product_research_jobs'));await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const lease=randomUUID();assert.equal((await begin(1,lease)).state,'acquired');assert.equal((await begin(1)).state,'running');
  assert.equal(await finish(1,randomUUID(),candidate),false);
  await assert.rejects(finish(1,lease,{status:'verified'}));
  assert.equal(await finish(1,lease,candidate),true);
  assert.equal((await begin(1)).state,'cached');
  await db.query('select public.pause_product_research_provider(900)');
  assert.equal((await begin(1)).state,'cached');
  assert.equal((await begin(10)).state,'provider-backoff');
  await db.exec('reset role');await db.exec("update private.product_research_control set provider_backoff_until=now()-interval '1 second'");await db.exec('set role service_role');
  const a=randomUUID(),b=randomUUID();assert.equal((await begin(2,a)).state,'acquired');assert.equal((await begin(3,b)).state,'acquired');assert.equal((await begin(4)).state,'busy');
  assert.equal(await finish(2,a,null),true);assert.equal((await begin(2)).state,'backoff');assert.equal(await finish(3,b,null),true);
  await db.exec('reset role');
  await db.query("update private.product_research_jobs set started_at=now()-interval '6 minutes' where query_hash=$1",[hash(2)]);
  await db.exec('set role service_role');const next=randomUUID();assert.equal((await begin(2,next)).state,'acquired');assert.equal(await finish(2,a,candidate),false);assert.equal(await finish(2,next,null),true);
  await db.exec('reset role');
  await db.exec("insert into private.product_research_attempts(lease_id,query_hash) select gen_random_uuid(),repeat('a',64) from generate_series(1,16)");
  await db.exec('set role service_role');assert.equal((await begin(5)).state,'daily-limit');
  await db.exec('reset role');
  await db.exec("update private.product_research_attempts set started_at=date_trunc('month',now())-interval '1 day';insert into private.product_research_attempts(lease_id,query_hash,started_at) select gen_random_uuid(),repeat('b',64),now()-interval '1 hour' from generate_series(1,200)");
  // Monthly accounting is distinct from the daily cap: move today's entries to an earlier month-day when possible.
  await db.exec("update private.product_research_attempts set started_at=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC') where query_hash=repeat('b',64)");
  await db.exec('set role service_role');const limited=(await begin(6)).state;assert.ok(['monthly-limit','daily-limit'].includes(limited));
 }finally{await db.close();}
});
