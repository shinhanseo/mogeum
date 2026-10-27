import test from 'node:test';
import assert from 'node:assert/strict';
import { groundedResearch,researchQuery } from '../supabase/functions/_shared/product-research';
const query={name:'합성 제품',category:'whisky' as const,edition:'12년'};
const metadata=()=>({webSearchQueries:['synthetic product producer'],groundingChunks:[{web:{uri:'https://producer.example/product',title:'Producer'}}],groundingSupports:[{segment:{text:'Source-backed description.'},groundingChunkIndices:[0]}]});
test('grounded product research is always a candidate and only cites actual source spans',()=>{
 const r=groundedResearch(query,'Source-backed description.',metadata());
 assert.equal(r.status,'candidate');assert.equal(r.sources.length,1);assert.equal(r.supports[0].sourceIndices[0],0);
 assert.ok(!('verified' in r));assert.ok(!('userId' in r));
});
test('ungrounded, invented citation references and local links are rejected',()=>{
 for(const patch of [{groundingChunks:[]},{groundingSupports:[]},{webSearchQueries:[]},{groundingSupports:[{segment:{text:'Invented quote'},groundingChunkIndices:[0]}]},{groundingSupports:[{segment:{text:'Source-backed description.'},groundingChunkIndices:[8]}]},{groundingChunks:[{web:{uri:'https://127.0.0.1/private'}}]}])assert.throws(()=>groundedResearch(query,'Source-backed description.',{...metadata(),...patch}));
});
test('research input is product-only: reject personal context, unsupported categories and oversized input',()=>{
 for(const value of [{...query,userId:'private'},{...query,records:[]},{...query,category:'other'},{...query,name:'x'.repeat(201)},{...query,name:'a\nb'},{...query,edition:undefined}])assert.throws(()=>researchQuery(value));
 assert.deepEqual(researchQuery(query),query);
});
