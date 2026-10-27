import test from 'node:test';import assert from 'node:assert/strict';
import {allowedResearchFeatures,validateResearchClaims} from '../supabase/functions/_shared/research-claims';
import {runProductResearch,type ResearchPorts} from '../supabase/functions/_shared/research-runner';
import type {GroundedResearch} from '../supabase/functions/_shared/product-research';
const research:GroundedResearch={status:'candidate',query:{name:'Synthetic malt',category:'whisky',edition:'12 years'},text:'Synthetic malt 12 years has fruit aroma.',sources:[{index:0,url:'https://producer.example/product',title:'Synthetic producer'}],supports:[{text:'Synthetic malt 12 years has fruit aroma.',sourceIndices:[0]}],queries:['Synthetic malt 12 years'],searchEntryPointHtml:null};
const claims={identity:{name:'Synthetic malt',edition:'12 years',supportIndex:0,sourceIndex:0,quote:research.text},features:[{factId:'향:과일 향',supportIndex:0,sourceIndex:0,quote:'fruit aroma'}]};
test('claim references use exact grounded quotes and the same source as product/edition identity',()=>{
 assert.deepEqual(validateResearchClaims(claims,research),claims);
 for(const category of ['whisky','wine','beer','traditional'] as const)assert.ok(allowedResearchFeatures(category).length>0);
 for(const patch of [
  {identity:{...claims.identity,edition:'18 years'}},
  {identity:{...claims.identity,quote:'fruit aroma'}},
  {features:[{...claims.features[0],quote:'vanilla aroma'}]},
  {features:[{...claims.features[0],sourceIndex:1}]},
  {features:[{...claims.features[0],factId:'향:없는 특징'}]},
  {features:[claims.features[0],claims.features[0]]},
  {identity:null},
  {verified:true},
 ])assert.throws(()=>validateResearchClaims({...claims,...patch},research));
 assert.deepEqual(validateResearchClaims({identity:null,features:[]},research),{identity:null,features:[]});
 const negative={...research,text:'Synthetic malt 12 years has no fruit aroma.',supports:[{text:'Synthetic malt 12 years has no fruit aroma.',sourceIndices:[0]}]};
 assert.throws(()=>validateResearchClaims({...claims,identity:{...claims.identity,quote:negative.text}},negative));
});
test('reserved research pipeline caches extraction once and validates persisted claims without a new provider call',async()=>{
 let searches=0,extracts=0,stored:unknown;
 const ports:ResearchPorts={version:'claims-v2',begin:async()=>stored?{state:'cached',result:stored}:{state:'acquired'},finish:async(_h,_l,result)=>{stored=result;return true;},research:async()=>{searches++;return {research};},extract:async()=>{extracts++;return claims;}};
 const first=await runProductResearch(research.query,ports);assert.equal(first.state,'candidate');
 const second=await runProductResearch(research.query,ports);assert.equal(second.state,'candidate');
 assert.equal(searches,1);assert.equal(extracts,1);
 assert.deepEqual((stored as {claims:unknown}).claims,claims);
 stored={...research,claims:{...claims,verified:true}};
 await assert.rejects(runProductResearch(research.query,ports));
 assert.equal(searches,1);assert.equal(extracts,1);
});
