import { validateMenuResult, menuCatalog } from "../src/features/menu/result-contract";
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {products} from '../supabase/functions/_shared/product-catalog';
import {SHARED_CATALOG_VERSION} from '../supabase/functions/_shared/catalog-contract';
test('dynamic menu HTTP uses verified new products, hides candidates and preserves menu amounts', {skip:process.env.MOGEUM_TEST_SUPABASE_HTTP!=='1',timeout:60000},async()=>{
 const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(status.API_URL,'http://127.0.0.1:54321');
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options),client=createClient(status.API_URL,status.ANON_KEY,options);
 const id=`synthetic-menu-${randomUUID()}`;let owner:string|undefined;
 try{
  const signed=await client.auth.signUp({email:`menu-${randomUUID()}@example.test`,password:randomUUID()+'Aa1!'});
  owner=signed.data.user?.id;assert.equal(signed.error,null);assert.ok(owner);
  const document={...products[0],id,familyId:id,name:'합성 새 술',aliases:['합성 새 술'],baseAliases:['합성 새 술']};
  assert.equal((await admin.from('product_catalog').insert({id,family_id:id,category:document.category,normalized_name:'synthetic',document,status:'candidate'})).error,null);
  const photoId=randomUUID();
  const photos=[{id:photoId,imageRevision:1,width:1200,height:1600,engine:'apple-vision-v1',lines:[{id:`${photoId}:1:0`,text:'합성 새 술 30ml 15,000원',confidence:0.9,polygon:[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.15},{x:0.1,y:0.15}]}]}];
  const request=async(body:Record<string,unknown>)=>{const r=await client.functions.invoke('menu-recommend',{body,timeout:30000});assert.equal(r.error,null);return r.data;};
  const candidate=await request({action:'parse',photos,catalogVersion:SHARED_CATALOG_VERSION});
  assert.ok(!candidate.catalog.some((p:{id:string})=>p.id===id));
  assert.equal((await admin.from('product_catalog').update({status:'verified',verified_at:new Date().toISOString()}).eq('id',id)).error,null);
  const parsed=await request({action:'parse',photos,catalogVersion:SHARED_CATALOG_VERSION});
  assert.ok(parsed.catalog.some((p:{id:string})=>p.id===id));
  assert.equal(parsed.items[0].price,15000);assert.equal(parsed.items[0].serving,'30ml');
  const items=[{...parsed.items[0],productId:id,confirmed:true}];
  const result=await request({action:'recommend',photos,items,catalogVersion:SHARED_CATALOG_VERSION});
  assert.equal(result.catalogVersion,SHARED_CATALOG_VERSION);
  assert.ok(menuCatalog(parsed).some(p=>p.id===id));
  assert.ok(validateMenuResult(result,items).catalog?.some(p=>p.id===id));
  assert.equal(result.recommendations[0].productId,id);
  assert.deepEqual(result.recommendations[0].similar,[]);
  const insufficient=await request({action:'recommend',photos,items,catalogVersion:SHARED_CATALOG_VERSION,recommendationVersion:'menu-selection-v1',researchVersion:'menu-research-v1'});
  assert.equal(insufficient.selectionState,'insufficient');assert.equal(insufficient.modelUsed,false);assert.equal(insufficient.research,undefined);
  assert.equal(validateMenuResult(insufficient,items).method,'evidence-rules-v1');
  if(process.env.MOGEUM_TEST_MENU_NO_KEY==='1'){
   const unknown={...items[0],id:`${photoId}:1:manual-research`,name:'합성 미등록 12년',productId:null,price:19000,serving:'45ml'};
   const unavailable=validateMenuResult(await request({action:'recommend',photos,items:[...items,unknown],catalogVersion:SHARED_CATALOG_VERSION,researchVersion:'menu-research-v1'}),[...items,unknown]);
   assert.equal(unavailable.recommendations.find(r=>r.itemId===unknown.id)?.status,'unverified');
   assert.equal(unavailable.research?.find(r=>r.itemId===unknown.id)?.state,'unavailable');
   assert.equal(unavailable.recommendations.length,2);
  }
  const invalid=await client.functions.invoke('menu-recommend',{body:{action:'recommend',photos,items:[{...items[0],name:'다른 제품'}],catalogVersion:SHARED_CATALOG_VERSION}});
  assert.ok(invalid.error);
  const legacy=await request({action:'parse',photos});assert.equal(legacy.catalog,undefined);
 }finally{
  if(owner)assert.equal((await admin.auth.admin.deleteUser(owner)).error,null);
  assert.equal((await admin.from('product_catalog').delete().eq('id',id)).error,null);
 }
});
