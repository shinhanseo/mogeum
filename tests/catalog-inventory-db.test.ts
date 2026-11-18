import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {products,normalizeProductName} from '../supabase/functions/_shared/product-catalog';
test('inventory catalog preserves owner boundaries, held decisions and family exclusions',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(await readFile(new URL('./fixtures/supabase-platform.sql',import.meta.url),'utf8'));
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const owner='10000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'inventory@example.test']);
  const ids=['inventory-'+'a'.repeat(32),'inventory-'+'b'.repeat(32),'inventory-'+'c'.repeat(32)];
  for(const [i,id] of ids.entries()){
   await db.query("insert into private.product_inventory(id,source,source_id,name,normalized_name,category,source_url,document,collected_at) values($1,'synthetic',$1,'fixture','fixture','whisky','https://example.com/product','{}',now())",[id]);
   const document={...products[0],id,familyId:'inventory-family',source:{...products[0].source,kind:'retailer'}};
   await db.query("insert into public.catalog_products(id,family_id,category,normalized_name,identity,document,state,primary_inventory_id,mapping_version) values($1,'inventory-family','whisky','fixture','[]',$2::jsonb,$3,$1,'test')",[id,JSON.stringify(document),i===2?'held':'ready']);
   await db.query('insert into public.catalog_product_aliases values($1,$2)',[normalizeProductName('테스트 위스키'),id]);
   await db.query('insert into public.catalog_product_features values($1,$2)',[products[0].features[0].id,id]);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
  const docs=await db.query<{n:number}>('select jsonb_array_length(public.catalog_product_documents($1::text[])) n',[ids]);assert.equal(docs.rows[0].n,2);
  const search=await db.query<{n:number}>('select jsonb_array_length(public.catalog_search($1::text[])) n',[[normalizeProductName('테스트 위스키')]]);assert.equal(search.rows[0].n,2);
  await assert.rejects(db.query('select * from private.product_inventory'),{code:'42501'});
  await assert.rejects(db.query("update public.catalog_products set state='ready'"),{code:'42501'});
  await db.query('select public.set_drink_wishlist($1,$2,true,0)',['20000000-0000-4000-8000-000000000001',ids[0]]);
  const candidates=await db.query<{n:number}>('select jsonb_array_length(public.catalog_recommendation_candidates($1::text[])) n',[[products[0].features[0].id]]);assert.equal(candidates.rows[0].n,0);
  await assert.rejects(db.query('select public.set_drink_wishlist($1,$2,true,0)',['20000000-0000-4000-8000-000000000002',ids[2]]),/PRODUCT_NOT_VERIFIED/);
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.catalog_products'),{code:'42501'});
 }finally{await db.close();}
});
