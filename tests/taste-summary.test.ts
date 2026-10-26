import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTasteSummary } from '../src/features/taste/repository';
import { analyzeTaste,validateSelection,SUMMARY_VERSION,type TasteRecord,type TasteSnapshot } from '../supabase/functions/_shared/taste-domain';
import { tasteHandler,type SummaryPorts,type TasteContext } from '../supabase/functions/_shared/taste-handler';
function record(n:number,patch:Partial<TasteRecord>={}):TasteRecord{return {id:`record-${n}`,entryId:`drink-${n}`,revision:1,category:'whisky',name:null,date:'2026-10-23',revisit:'again',rating:null,note:{mode:'light',version:2,inputRevision:1,confirmedInputRevision:1,confirmed:true,answers:[{questionId:'nose',status:'answered',descriptorCodes:['fruit']}]},...patch};}
const snapshot=(records:TasteRecord[]):TasteSnapshot=>({hash:'a'.repeat(32),records,totalRecords:records.length,omittedCount:0});
test('0/2/8 records, repeated drinks and independent observations remain distinct',()=>{
 assert.equal(analyzeTaste(snapshot([])).stage,'empty');
 const early=analyzeTaste(snapshot([record(1),record(2)]));assert.equal(early.stage,'early');assert.equal(early.facts[0].label,'과일 향');
 const repeated=analyzeTaste(snapshot(Array.from({length:8},(_,n)=>record(n,{entryId:'same'}))));assert.equal(repeated.drinkCount,1);assert.equal(repeated.stage,'early');assert.equal(repeated.facts[0].distinctPositiveDrinks,1);
 const diverse=analyzeTaste(snapshot(Array.from({length:8},(_,n)=>record(n))));assert.equal(diverse.stage,'established');assert.equal(diverse.facts[0].distinctPositiveDrinks,8);
 const moved=analyzeTaste(snapshot(Array.from({length:8},(_,n)=>record(n,{entryId:n===7?'moved':'same'}))));assert.equal(moved.drinkCount,2);assert.equal(moved.stage,'growing');
});
test('photos, unknown ratings, stale notes, legacy modes and skipped feelings never supply preferences',()=>{
 const input=record(1);const note=input.note!;
 for(const patch of [{note:null},{revisit:null,rating:null},{note:{...note,confirmed:false}},{note:{...note,confirmedInputRevision:0}},{note:{...note,version:1}},{note:{...note,mode:'unsupported'}},{note:{...note,answers:[{questionId:'nose',status:'unknown',descriptorCodes:['fruit']}]}},{note:{...note,answers:[{questionId:'nose',status:'answered',descriptorCodes:['fabricated']}]} }])assert.equal(analyzeTaste(snapshot([record(1,patch)])).recordCount,0);
});
test('aroma sweetness is not palate sweetness; mixed evaluations are not averaged away',()=>{
 const sweet=record(1,{note:{...record(1).note!,mode:'deep',answers:[{questionId:'nose',status:'answered',descriptorCodes:['family.sweet','detail.sweet.vanilla']}]}});
 const mixed=analyzeTaste(snapshot([sweet,record(2,{revisit:'not_for_me',note:sweet.note}),record(3,{revisit:'okay',note:sweet.note})]));
 assert.equal(mixed.facts.length,1);assert.equal(mixed.facts[0].dimension,'향');assert.equal(mixed.facts[0].positiveIds.length,1);assert.equal(mixed.facts[0].negativeIds.length,1);assert.equal(mixed.facts[0].neutralIds.length,1);
 assert.ok(!JSON.stringify(mixed.facts).includes('단맛'));
 assert.throws(()=>validateSelection({highlightIds:['맛:달콤함']},mixed));
 assert.throws(()=>validateSelection({highlightIds:[mixed.facts[0].id],text:'Invented claim'},mixed));
 assert.throws(()=>validateSelection({highlightIds:[mixed.facts[0].id,mixed.facts[0].id]},mixed));
});
function harness(){let calls=0;let finished:unknown='unset';const context:TasteContext={snapshot:snapshot([record(1)]),cached:null,stale:false,running:false};const ports:SummaryPorts={model:'fixture-provider',authenticate:async()=>({id:'owner'}),context:async()=>context,configured:()=>true,begin:async()=>{calls++;return 'acquired';},finish:async(_owner,_hash,_lease,result)=>{finished=result;return true;},select:async analysis=>({highlightIds:[analysis.facts[0].id]})};return {ports,context,calls:()=>calls,finished:()=>finished};}
const request=(body='{}',token='token')=>new Request('http://localhost/taste-summary',{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
test('handler validates auth, accepts no client owner or evidence, and never exposes configuration errors',async()=>{
 const h=harness();const handler=tasteHandler(h.ports);
 assert.equal((await handler(request('x'.repeat(2048)))).status,413);
 assert.equal((await handler(request('{"userId":"other"}'))).status,400);assert.equal(h.calls(),0);
 h.ports.authenticate=async()=>null;assert.equal((await handler(request())).status,401);assert.equal(h.calls(),0);
 h.ports.authenticate=async()=>({id:'owner'});h.ports.configured=()=>false;const missing=await handler(request());assert.equal(missing.status,503);assert.equal((await missing.json()).code,'AI_NOT_CONFIGURED');assert.equal(h.calls(),0);
});
test('cached inputs and photo-only records do not consume model calls',async()=>{
 const h=harness();const fact=analyzeTaste(h.context.snapshot).facts[0];h.context.cached={version:SUMMARY_VERSION,selection:{highlightIds:[fact.id]},generatedAt:'2026-10-23',model:'fixture'};
 assert.equal((await tasteHandler(h.ports)(request())).status,200);assert.equal(h.calls(),0);
 h.context.cached=null;h.context.snapshot=snapshot([record(1,{note:null})]);assert.equal((await(await tasteHandler(h.ports)(request())).json()).state,'insufficient');assert.equal(h.calls(),0);
});
test('leases stop concurrent generation and invalid output or stale completion never becomes a saved summary',async()=>{
 const h=harness();h.ports.begin=async()=> 'running';assert.equal((await tasteHandler(h.ports)(request())).status,202);assert.equal(h.finished(),'unset');
 h.ports.begin=async()=> 'acquired';h.ports.select=async()=>({highlightIds:['foreign-record']});assert.equal((await tasteHandler(h.ports)(request())).status,502);assert.equal(h.finished(),null);
 h.ports.select=async analysis=>({highlightIds:[analysis.facts[0].id]});h.ports.finish=async()=>false;assert.equal((await tasteHandler(h.ports)(request())).status,409);
 h.ports.finish=async()=>true;assert.equal((await tasteHandler(h.ports)(request())).status,200);
});

test('client generation pins the action owner JWT and rejects a switched account before invocation',async()=>{
 let calls=0;let owner='owner';const fake={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-token'}}})},functions:{invoke:async(_name:string,options:{headers:{Authorization:string}})=>{calls++;assert.equal(options.headers.Authorization,'Bearer synthetic-token');return {data:{state:'ready',hash:'fixture'},error:null};}}} as unknown as SupabaseClient;
 await generateTasteSummary(fake,'owner');assert.equal(calls,1);owner='other';await assert.rejects(generateTasteSummary(fake,'owner'));assert.equal(calls,1);
});

test('provider timeouts release the lease, never cache a summary, and return only a safe retry code',async()=>{
 for(const name of ['TimeoutError','AbortError']){
 const h=harness();let selections=0;h.ports.select=async()=>{selections++;throw Object.assign(new Error('private provider response'),{name});};
 const response=await tasteHandler(h.ports)(request());assert.equal(response.status,502);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{code:'ANALYSIS_TIMEOUT',retryable:true});assert.equal(h.finished(),null);assert.equal(selections,1);
 }
});

test('deep tasting intensity preserves its question context and never merges weak sweetness with weak acidity',()=>{
 const deep={...record(1).note!,mode:'deep',answers:[{questionId:'palate.sweet',status:'answered',descriptorCodes:['level_1']},{questionId:'palate.acid',status:'answered',descriptorCodes:['level_1']}]};
 const analysis=analyzeTaste(snapshot([record(1,{note:deep})]));
 assert.equal(analysis.facts.length,2);assert.equal(new Set(analysis.facts.map(f=>f.id)).size,2);
 assert.deepEqual(analysis.facts.map(f=>f.label).sort(),['단맛 · 약함','산미 · 약함'].sort());
 const contrast=analyzeTaste(snapshot([record(1,{note:{...deep,answers:deep.answers.slice(0,1)}}),record(2,{revisit:'not_for_me',note:{...deep,answers:deep.answers.slice(1)}})]));
 const sweet=contrast.facts.find(f=>f.label==='단맛 · 약함')!,acid=contrast.facts.find(f=>f.label==='산미 · 약함')!;
 assert.equal(sweet.positiveIds.length,1);assert.equal(sweet.negativeIds.length,0);assert.equal(acid.positiveIds.length,0);assert.equal(acid.negativeIds.length,1);
});
