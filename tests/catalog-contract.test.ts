import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../supabase/functions/_shared/product-catalog';
import { parseCatalogDocument, publicSourceUrl } from '../supabase/functions/_shared/catalog-contract';
test('seed product documents keep exact editions and sources',()=>{
 for(const product of products){const {familyId,...parsed}=parseCatalogDocument({...product,familyId:product.id});assert.equal(familyId,product.id);assert.deepEqual(parsed,product);}
});
test('untrusted product documents reject malformed identity, sources and duplicate claims',()=>{
 const base={...products[0],familyId:'glenlivet'};
 for(const patch of [{id:'../bad'}, {familyId:'A B'}, {category:'other'}, {aliases:['same','same']}, {features:[base.features[0],base.features[0]]}, {source:{...base.source,checkedAt:'2026-02-30'}}, {source:{...base.source,url:'http://example.com'}}, {source:{...base.source,kind:'gemini-says-so'}}])assert.throws(()=>parseCatalogDocument({...base,...patch}));
 for(const url of ['https://127.0.0.1','https://localhost.test','https://a.local','https://x@foo.com','https://foo.com:8443','https://[::1]','file:///tmp/key'])assert.throws(()=>publicSourceUrl(url));
 assert.equal(publicSourceUrl('https://www.theglenlivet.com/product'),'https://www.theglenlivet.com/product');
});
