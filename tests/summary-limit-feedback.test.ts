import test from 'node:test';import assert from 'node:assert/strict';
import {tasteHandler,type SummaryPorts} from '../supabase/functions/_shared/taste-handler';
import {tasteSummaryFailureMessage} from '../src/features/taste/failure-message';
const context={snapshot:{hash:'synthetic',totalRecords:1,omittedCount:0,records:[{id:'record',entryId:'entry',revision:1,category:'whisky',name:'합성 술',date:'2026-10-28',revisit:'again',rating:null,note:{mode:'light',version:2,inputRevision:1,confirmedInputRevision:1,confirmed:true,answers:[{questionId:'nose',status:'answered',descriptorCodes:['fruit']}]}}]},cached:null,stale:false,running:false};
test('daily budget, short cooldown, and provider quota are distinct and never call model when app-limited',async()=>{
 let selected=0,finished=0,state='daily-limit';
 const ports:SummaryPorts={model:'synthetic',authenticate:async()=>({id:'owner'}),context:async()=>context,configured:()=>true,begin:async()=>state,finish:async()=>{finished++;return true;},select:async()=>{selected++;throw Object.assign(new Error('private provider body'),{statusCode:429});}};
 const request=()=>new Request('https://edge.example/taste-summary',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:'{}'});
 let response=await tasteHandler(ports)(request());let body=await response.json();assert.equal(body.code,'SUMMARY_DAILY_LIMIT');assert.ok(body.retryAfterSeconds>0&&body.retryAfterSeconds<=86400);assert.equal(selected,0);
 state='cooldown';response=await tasteHandler(ports)(request());assert.deepEqual(await response.json(),{code:'SUMMARY_COOLDOWN',retryable:true,retryAfterSeconds:20});assert.equal(selected,0);
 state='limited';response=await tasteHandler(ports)(request());assert.equal((await response.json()).code,'RATE_LIMITED');assert.equal(selected,0);
 state='acquired';response=await tasteHandler(ports)(request());assert.equal(response.status,429);body=await response.json();assert.equal(body.code,'AI_PROVIDER_LIMITED');assert.ok(!JSON.stringify(body).includes('private'));assert.equal(finished,1);
});
test('copy never claims daily exhaustion for short cooldown, legacy limitation or provider 429',()=>{
 assert.match(tasteSummaryFailureMessage('SUMMARY_DAILY_LIMIT'),/오전 9시/);
 assert.match(tasteSummaryFailureMessage('SUMMARY_COOLDOWN'),/20초/);
 for(const code of ['SUMMARY_COOLDOWN','RATE_LIMITED','AI_PROVIDER_LIMITED','malicious provider text'])assert.doesNotMatch(tasteSummaryFailureMessage(code),/오늘.*모두|일일.*한도/);
});
