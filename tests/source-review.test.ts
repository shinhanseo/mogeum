import test from 'node:test';import assert from 'node:assert/strict';
import {reviewResearchSources} from '../supabase/functions/_shared/source-review';
import {researchAdminHandler} from '../supabase/functions/_shared/research-admin-handler';
import type {ReviewResearch} from '../supabase/functions/_shared/research-runner';
const research:ReviewResearch={status:'candidate',query:{name:'Synthetic malt',category:'whisky',edition:'12 years'},text:'Synthetic malt 12 years has fruit aroma.',sources:[{index:0,url:'https://producer.example/product',title:'Producer'}],supports:[{text:'Synthetic malt 12 years has fruit aroma.',sourceIndices:[0]}],queries:['Synthetic malt'],searchEntryPointHtml:null,claims:{identity:{name:'Synthetic malt',edition:'12 years',supportIndex:0,sourceIndex:0,quote:'Synthetic malt 12 years'},features:[{factId:'향:과일 향',supportIndex:0,sourceIndex:0,quote:'fruit aroma'}]}};
test('direct producer text matches quotes but never returns a verified product',async()=>{
 let calls=0;
 const result=await reviewResearchSources(research,{origins:['https://producer.example'],signal:AbortSignal.timeout(1000),fetcher:async(_url,init)=>{calls++;assert.equal(init?.redirect,'manual');assert.ok(!('Authorization' in (init?.headers??{})));return new Response('<p>Synthetic malt 12 years</p><p>Fruit&nbsp;aroma.</p>',{headers:{'content-type':'text/html'}});}});
 assert.equal(calls,1);assert.equal(result[0].state,'quote-matched');assert.equal(result[0].identityMatched,true);assert.deepEqual(result[0].matchedFactIds,['향:과일 향']);assert.ok(!('verified' in result[0]));
});
test('unapproved origins and redirect pivots never initiate a request to the target',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}});};
 assert.equal((await reviewResearchSources(research,{origins:[],signal:AbortSignal.timeout(1000),fetcher}))[0].state,'unapproved-source');assert.equal(calls,0);
 assert.equal((await reviewResearchSources(research,{origins:['https://producer.example'],signal:AbortSignal.timeout(1000),fetcher}))[0].state,'unavailable');assert.equal(calls,1);
 const other:typeof fetch=async()=>new Response(null,{status:302,headers:{location:'https://unapproved.example/product'}});
 assert.equal((await reviewResearchSources(research,{origins:['https://producer.example'],signal:AbortSignal.timeout(1000),fetcher:other}))[0].state,'unapproved-source');
});
test('scripts, missing identity, oversize and non-text content cannot serve as direct quote evidence',async()=>{
 for(const [response,state] of [
  [new Response('<script>Synthetic malt 12 years fruit aroma</script><p>Other product</p>',{headers:{'content-type':'text/html'}}),'quote-not-found'],
  [new Response('fruit aroma',{headers:{'content-type':'text/plain'}}),'quote-not-found'],
  [new Response('ignored',{headers:{'content-type':'application/json'}}),'unsupported-content'],
  [new Response('ignored',{headers:{'content-type':'text/plain','content-length':'512001'}}),'unavailable'],
  [new Response('a'.repeat(512001),{headers:{'content-type':'text/plain'}}),'unavailable'],
 ] as const){assert.equal((await reviewResearchSources(research,{origins:['https://producer.example'],signal:AbortSignal.timeout(1000),fetcher:async()=>response}))[0].state,state);}
});
test('admin research endpoint rejects user/publishable/unknown secrets and personal fields before any provider call',async()=>{
 let calls=0;
 const handler=researchAdminHandler({secret:'synthetic-service-secret',run:async()=>{calls++;return {state:'candidate'};}});
 const request=(token?:string,body:unknown=research.query)=>new Request('https://edge.example/product-research',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)});
 for(const token of [undefined,'sb_publishable_example','user-jwt','wrong'])assert.equal((await handler(request(token))).status,401);
 assert.equal((await handler(request('synthetic-service-secret',{...research.query,userId:'private'}))).status,400);
 assert.equal(calls,0);
 assert.equal((await handler(request('synthetic-service-secret'))).status,200);assert.equal(calls,1);
});

test('Google grounding bridge resolves only to approved producer and retains original evidence',async()=>{
 const {originalSourceEvidence}=await import('../supabase/functions/_shared/source-review');
 const bridged={...research,sources:[{index:0,url:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/synthetic',title:'Producer'}]};
 const urls:string[]=[];
 const result=await originalSourceEvidence(bridged,{signal:AbortSignal.timeout(1000),origins:['https://producer.example'],fetcher:async(url)=>{
  urls.push(String(url));return urls.length===1?new Response(null,{status:302,headers:{location:'https://producer.example/product'}}):new Response('<p>Synthetic malt 12 years has fruit aroma.</p>',{headers:{'content-type':'text/html'}});
 }});
 assert.equal(result.sources[0].url,'https://producer.example/product');assert.equal(result.supports.length,2);assert.ok(result.text.includes('Original producer excerpt:'));
 let calls=0;
 const blocked=await originalSourceEvidence(bridged,{signal:AbortSignal.timeout(1000),origins:['https://producer.example'],fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://untrusted.example/private'}});}});
 assert.equal(calls,1);assert.equal(blocked.supports.length,1);
});
