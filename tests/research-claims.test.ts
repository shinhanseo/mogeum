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

test('extraction repairs unique citations but drops unsupported, ambiguous and negated traits',async()=>{
 const {extractSupportedClaims}=await import('../supabase/functions/_shared/research-claims');
 const input={...research,text:'**Synthetic malt** 12 years. Fruit aroma. No vanilla aroma.',supports:[{text:'**Synthetic malt** 12 years.',sourceIndices:[0]},{text:'Fruit aroma.',sourceIndices:[0]},{text:'No vanilla aroma.',sourceIndices:[0]}]};
 const result=extractSupportedClaims({identity:{...claims.identity,quote:'Synthetic malt 12 years.'},features:[{...claims.features[0],supportIndex:0,quote:'Fruit aroma.'},{...claims.features[0],factId:'향:꿀·바닐라 향',quote:'vanilla aroma.'},{...claims.features[0],factId:'향:나무 향',quote:'wood aroma'}]},input);
 assert.equal(result.features.length,1);assert.equal(result.features[0].supportIndex,1);assert.equal(result.identity?.quote,'**Synthetic malt** 12 years.');
 assert.equal(extractSupportedClaims({...claims,identity:{...claims.identity,quote:'Invented malt'}},input).identity,null);
 const ambiguous={...input,supports:[...input.supports,input.supports[1]]};
 assert.equal(extractSupportedClaims({identity:{...claims.identity,quote:'Synthetic malt 12 years.'},features:[{...claims.features[0],quote:'Fruit aroma.'}]},ambiguous).features.length,0);
});

test('reviewed research product preserves standard edition and existing recommendation feature IDs',async()=>{
 const {readFileSync}=await import('node:fs');
 const {parseCatalogDocument,catalogProduct}=await import('../supabase/functions/_shared/catalog-contract');
 const {productCandidates}=await import('../supabase/functions/_shared/product-catalog');
 const p=parseCatalogDocument(JSON.parse(readFileSync('supabase/catalog/2026-10-31-research-reviewed.json','utf8'))[0]);
 const products=[catalogProduct(p)];
 assert.equal(productCandidates('Bunnahabhain 12 Year Old',products)[0]?.id,p.id);
 assert.equal(productCandidates('Bunnahabhain 12 Year Old Cask Strength 2026',products).length,0);
 const allowed=new Set(allowedResearchFeatures('whisky').map(f=>f.id));
 assert.ok(p.features.every(f=>allowed.has(f.id)));
});
