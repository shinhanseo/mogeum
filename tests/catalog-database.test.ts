import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogCandidates,catalogDocuments,searchCatalog} from '../supabase/functions/_shared/catalog-database';
import {products} from '../supabase/functions/_shared/product-catalog';
import {parseCatalogDocument} from '../supabase/functions/_shared/catalog-contract';
const document={...products[0],familyId:products[0].id,source:{...products[0].source,kind:'retailer'}};
test('database catalog validates attributed documents and deduplicates exact lookups',async()=>{
 const calls:{name:string,args:Record<string,unknown>}[]=[];
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:[document],error:null};}};
 assert.equal((await searchCatalog(db,['테스트 4.5','테스트 4.5'],[document.id])).length,1);
 assert.deepEqual(calls[1].args.p_aliases,['테스트4decimal5']);
 assert.equal(parseCatalogDocument(document).source.kind,'retailer');
 await catalogCandidates(db,['향:과일 향','향:과일 향']);
 assert.deepEqual(calls[2].args.p_features,['향:과일 향']);
});
test('saved product metadata is fetched in bounded batches and transport errors never become facts',async()=>{
 const sizes:number[]=[];
 await catalogDocuments({rpc:async(_name,args)=>{sizes.push((args.p_ids as string[]).length);return {data:[],error:null};}},Array.from({length:401},(_,i)=>`product-${i}`));
 assert.deepEqual(sizes,[200,200,1]);
 await assert.rejects(catalogCandidates({rpc:async()=>({data:[],error:{message:'fail'}})},[]),/CATALOG_CANDIDATES_FAILED/);
 await assert.rejects(catalogCandidates({rpc:async()=>({data:[{...document,source:{...document.source,url:'http://localhost'}}],error:null})},[]),/INVALID_CATALOG_DOCUMENT/);
});
